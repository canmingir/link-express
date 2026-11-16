import { describe, expect, test } from "bun:test";
import Joi from "joi";
import {
  createApp,
  KernelError,
  type LayerContext,
  type LayerDefinition,
  overridable,
  point,
  type PointHandle,
} from ".";

interface Action {
  name: string;
  run: () => string;
}

const actions = point<Action>("base.actions");
const llm = point<{ name: string }>("base.llm");
const tags = point<string>("base.tags");
const channels = point<{ type: string }>("mid.channels");

const actionSchema = Joi.object({
  name: Joi.string().required(),
  run: Joi.func().required(),
});

function base(capture: { actions?: PointHandle<Action> } = {}): LayerDefinition {
  return {
    name: "base",
    setup(ctx) {
      capture.actions = ctx.define(actions, {
        cardinality: "keyed",
        key: (action) => action.name,
        schema: actionSchema,
        builtins: [{ name: "builtin", run: () => "base" }],
      });
      ctx.define(llm, {
        cardinality: "single",
        schema: Joi.object({ name: Joi.string().required() }),
        default: { name: "default-llm" },
      });
      ctx.define(tags, { cardinality: "list", schema: Joi.string() });
    },
  };
}

const layer = (name: string, setup: (ctx: LayerContext) => void) => ({
  name,
  setup,
});

const quiet = () => createApp({ log: () => {} });

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (error) => error,
  );
  expect(error).toBeInstanceOf(KernelError);
  expect((error as KernelError).code).toBe(code as never);
}

describe("extension point ownership", () => {
  test("a layer can only define points in its own namespace", async () => {
    const app = quiet();
    await expectCode(
      app.use(layer("nuc", (ctx) => ctx.define(actions, { cardinality: "list", schema: actionSchema }))),
      "POINT_NAMESPACE",
    );
  });

  test("the owner cannot contribute to its own point", async () => {
    const app = quiet();
    await expectCode(
      app.use({
        name: "base",
        setup(ctx) {
          ctx.define(tags, { cardinality: "list", schema: Joi.string() });
          ctx.contribute(tags, "self");
        },
      }),
      "SELF_CONTRIBUTION",
    );
  });

  test("a point defined by a sibling branch is unknown", async () => {
    const app = quiet();
    await app.use(base());
    await expectCode(
      app.use(layer("ops", (ctx) => ctx.contribute(channels, { type: "sms" }))),
      "POINT_UNKNOWN",
    );
  });

  test("only the owner holds a readable handle", async () => {
    const capture: { actions?: PointHandle<Action> } = {};
    const app = quiet();
    await app.use(base(capture));
    await app.use(layer("host", (ctx) => ctx.contribute(actions, { name: "check_line", run: () => "ok" })));
    await app.start();

    expect(capture.actions!.items().map((a) => a.name)).toEqual(["builtin", "check_line"]);
    expect(capture.actions!.contributions().map((c) => c.layer)).toEqual(["base", "host"]);
    const summary = app.describe().points.find((p) => p.id === "base.actions")!;
    expect(summary.contributions).toEqual([
      { layer: "base", key: "builtin" },
      { layer: "host", key: "check_line" },
    ]);
  });

  test("a layer context is dead once its setup returns", async () => {
    let stashed: LayerContext | undefined;
    const app = quiet();
    await app.use(base());
    await app.use(layer("host", (ctx) => (stashed = ctx)));
    expect(() => stashed!.contribute(tags, "late")).toThrow(KernelError);
  });
});

describe("contribution rules", () => {
  test("contributions are validated against the owner's schema", async () => {
    const app = quiet();
    await app.use(base());
    await expectCode(
      app.use(layer("host", (ctx) => ctx.contribute(actions, { name: "broken" } as Action))),
      "CONTRIBUTION_INVALID",
    );
  });

  test("keyed points reject a duplicate key, including builtins", async () => {
    const app = quiet();
    await app.use(base());
    await expectCode(
      app.use(layer("host", (ctx) => ctx.contribute(actions, { name: "builtin", run: () => "x" }))),
      "KEY_CONFLICT",
    );
  });

  test("single points fall back to the default and accept one replacement", async () => {
    let handle: PointHandle<{ name: string }> | undefined;
    const app = quiet();
    await app.use({
      name: "base",
      setup(ctx) {
        handle = ctx.define(llm, {
          cardinality: "single",
          schema: Joi.object({ name: Joi.string().required() }),
          default: { name: "default-llm" },
        });
      },
    });
    await app.use(layer("mid", (ctx) => ctx.contribute(llm, { name: "custom" })));
    await expectCode(
      app.use(layer("host", (ctx) => ctx.contribute(llm, { name: "another" }))),
      "SINGLE_CONFLICT",
    );

    const fresh = quiet();
    await fresh.use({
      name: "base",
      setup(ctx) {
        handle = ctx.define(llm, {
          cardinality: "single",
          schema: Joi.object({ name: Joi.string().required() }),
          default: { name: "default-llm" },
        });
      },
    });
    await fresh.start();
    expect(handle!.value().name).toBe("default-llm");
  });

  test("a single point without default must be contributed", async () => {
    const app = quiet();
    await app.use(layer("base", (ctx) => ctx.define(llm, { cardinality: "single", schema: Joi.object() })));
    await expectCode(app.start(), "POINT_EMPTY");
    expect(app.phase).toBe("failed");
  });

  test("handles cannot be read before the app is sealed", async () => {
    const capture: { actions?: PointHandle<Action> } = {};
    const app = quiet();
    await app.use(base(capture));
    expect(() => capture.actions!.items()).toThrow(KernelError);
  });

  test("nothing can be added after start", async () => {
    const app = quiet();
    await app.use(base());
    await app.start();
    await expectCode(app.use(layer("late", () => {})), "SEALED");
  });

  test("cross-contribution validation runs at seal time", async () => {
    const blueprints = point<{ name: string; actions: string[] }>("base.blueprints");
    const app = quiet();
    await app.use({
      name: "base",
      setup(ctx) {
        const known = ctx.define(actions, {
          cardinality: "keyed",
          key: (a) => a.name,
          schema: actionSchema,
        });
        ctx.define(blueprints, {
          cardinality: "keyed",
          key: (b) => b.name,
          schema: Joi.object({ name: Joi.string(), actions: Joi.array().items(Joi.string()) }),
          validate(handle) {
            for (const blueprint of handle.items()) {
              const missing = blueprint.actions.filter((a) => !known.has(a));
              if (missing.length) throw new Error(`${blueprint.name} uses unknown ${missing}`);
            }
          },
        });
      },
    });
    await app.use(layer("host", (ctx) => ctx.contribute(blueprints, { name: "support", actions: ["check_line"] })));
    await expectCode(app.start(), "POINT_VALIDATION");
  });
});

describe("lifecycle", () => {
  function traced(name: string, fail?: string): LayerDefinition {
    return {
      name,
      setup(ctx) {
        for (const hook of ["migrate", "seed", "start", "ready", "drain", "stop"] as const) {
          ctx.on(hook, () => {
            if (fail === hook) throw new Error(`${name} ${hook} failed`);
          });
        }
      },
    };
  }

  test("up hooks run bottom to top, down hooks top to bottom", async () => {
    const app = quiet();
    for (const name of ["link", "nuc", "greycollar", "host"]) await app.use(traced(name));
    await app.start();
    await app.stop();

    const order = (hook: string) =>
      app.trace.filter((t) => t.startsWith(`${hook}:`)).map((t) => t.split(":")[1]);

    expect(order("migrate")).toEqual(["link", "nuc", "greycollar", "host"]);
    expect(order("start")).toEqual(["link", "nuc", "greycollar", "host"]);
    expect(order("stop")).toEqual(["host", "greycollar", "nuc", "link"]);
    expect(app.trace.indexOf("ready:link")).toBeGreaterThan(app.trace.indexOf("start:host"));
    expect(app.trace.indexOf("drain:link")).toBeLessThan(app.trace.indexOf("stop:host"));
    expect(app.phase).toBe("stopped");
  });

  test("a failing start unwinds the layers that already ran", async () => {
    const app = quiet();
    for (const name of ["link", "nuc"]) await app.use(traced(name));
    await app.use(traced("greycollar", "start"));
    await app.use(traced("host"));

    await expect(app.start()).rejects.toThrow("greycollar start failed");

    expect(app.phase).toBe("failed");
    expect(app.trace.filter((t) => t.startsWith("stop:"))).toEqual([
      "stop:host",
      "stop:greycollar",
      "stop:nuc",
      "stop:link",
    ]);
    expect(app.trace).not.toContain("start:host");
  });
});

describe("overridable functions", () => {
  const owner = (functions: object) =>
    layer("base", (ctx) => ctx.open(functions as never, "base functions"));

  const greet = () =>
    overridable("base.greet", {
      hello: (name: string) => `hello ${name}`,
      bye: (name: string) => `bye ${name}`,
    });

  test("calls go to the base before start", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(layer("mid", (ctx) => ctx.extend(fns, { hello: () => () => "mid" })));

    expect(fns.hello("ada")).toBe("hello ada");
  });

  test("extensions wrap the base with the top layer outermost", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(
      layer("mid", (ctx) =>
        ctx.extend(fns, { hello: (next) => (name) => `[mid ${next(name)}]` }),
      ),
    );
    await app.use(
      layer("top", (ctx) =>
        ctx.extend(fns, { hello: (next) => (name) => `[top ${next(name.toUpperCase())}]` }),
      ),
    );
    await app.start();

    expect(fns.hello("ada")).toBe("[top [mid hello ADA]]");
    expect(fns.bye("ada")).toBe("bye ada");
  });

  test("an extension that skips next replaces the function", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(layer("top", (ctx) => ctx.extend(fns, { bye: () => () => "replaced" })));
    await app.start();

    expect(fns.bye("ada")).toBe("replaced");
  });

  test("stop restores the base", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(layer("top", (ctx) => ctx.extend(fns, { bye: () => () => "replaced" })));
    await app.start();
    await app.stop();

    expect(fns.bye("ada")).toBe("bye ada");
  });

  test("a failed start restores the base", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(
      layer("top", (ctx) => {
        ctx.extend(fns, { bye: () => () => "replaced" });
        ctx.on("start", () => {
          throw new Error("boom");
        });
      }),
    );

    await expect(app.start()).rejects.toThrow("boom");
    expect(fns.bye("ada")).toBe("bye ada");
  });

  test("the function object cannot be patched directly", () => {
    const fns = greet();

    expect(() => {
      (fns as { hello: unknown }).hello = () => "patched";
    }).toThrow();
  });

  test("unknown function names are rejected", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));

    await expectCode(
      app.use(
        layer("top", (ctx) =>
          ctx.extend(fns, { helo: () => () => "typo" } as never),
        ),
      ),
      "CONTRIBUTION_INVALID",
    );
  });

  test("an extension must return a function", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(layer("top", (ctx) => ctx.extend(fns, { hello: () => "nope" as never })));

    await expectCode(app.start(), "CONTRIBUTION_INVALID");
    expect(app.phase).toBe("failed");
  });

  test("only the namespace owner can open", async () => {
    const app = quiet();

    await expectCode(
      app.use(layer("other", (ctx) => ctx.open(greet()))),
      "POINT_NAMESPACE",
    );
  });

  test("extending a closed object fails", async () => {
    const app = quiet();
    await app.use(layer("base", () => {}));

    await expectCode(
      app.use(layer("top", (ctx) => ctx.extend(greet(), { hello: (next) => next }))),
      "POINT_UNKNOWN",
    );
  });

  test("the owner cannot extend its own functions", async () => {
    const fns = greet();
    const app = quiet();

    await expectCode(
      app.use(
        layer("base", (ctx) => {
          ctx.open(fns);
          ctx.extend(fns, { hello: (next) => next });
        }),
      ),
      "SELF_CONTRIBUTION",
    );
  });

  test("plain objects are not overridable", async () => {
    const app = quiet();

    await expectCode(
      app.use(layer("base", (ctx) => ctx.open({ hello: () => "hi" }))),
      "NOT_OVERRIDABLE",
    );
  });

  test("describe lists who extended what", async () => {
    const fns = greet();
    const app = quiet();
    await app.use(owner(fns));
    await app.use(layer("top", (ctx) => ctx.extend(fns, { hello: (next) => next })));
    await app.start();

    expect(app.describe().points).toContainEqual({
      id: "base.greet",
      owner: "base",
      cardinality: "list",
      description: "base functions",
      contributions: [{ layer: "top", key: undefined }],
    });
  });
});
