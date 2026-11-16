import {
  ExtensionPoint,
  type PointDefinition,
  type PointHandle,
  type PointRef,
  type PointSummary,
} from "./point";
import { KernelError } from "./errors";
import {
  type Extension,
  type Functions,
  type Surface,
  surfaceOf,
} from "./overridable";

export type Phase =
  | "initializing"
  | "migrating"
  | "seeding"
  | "starting"
  | "running"
  | "draining"
  | "stopping"
  | "stopped"
  | "failed";

export type Hook = "migrate" | "seed" | "start" | "ready" | "drain" | "stop";

const UP: { hook: Hook; phase: Phase }[] = [
  { hook: "migrate", phase: "migrating" },
  { hook: "seed", phase: "seeding" },
  { hook: "start", phase: "starting" },
  { hook: "ready", phase: "starting" },
];

const DOWN: { hook: Hook; phase: Phase }[] = [
  { hook: "drain", phase: "draining" },
  { hook: "stop", phase: "stopping" },
];

export interface AppDescription {
  phase: Phase;
  path: string[];
  points: PointSummary[];
}

export interface LayerContext {
  readonly name: string;
  readonly path: readonly string[];
  define<T>(ref: PointRef<T>, definition: PointDefinition<T>): PointHandle<T>;
  contribute<T>(ref: PointRef<T>, item: T): void;
  provides(ref: PointRef<unknown>): boolean;
  open<T extends Functions>(functions: T, description?: string): void;
  extend<T extends Functions>(functions: T, extension: NoInfer<Extension<T>>): void;
  on(hook: Hook, fn: () => unknown): void;
  describe(): AppDescription;
  log(message: string): void;
}

export interface LayerDefinition {
  name: string;
  setup(ctx: LayerContext): void | Promise<void>;
}

interface LayerRecord {
  name: string;
  hooks: Map<Hook, (() => unknown)[]>;
}

export interface AppOptions {
  log?: (line: string) => void;
}

export class App {
  readonly trace: string[] = [];
  private current: Phase = "initializing";
  private readonly layers: LayerRecord[] = [];
  private readonly points = new Map<string, ExtensionPoint<any>>();
  private readonly surfaces: { surface: Surface<any>; point: ExtensionPoint<any> }[] = [];
  private readonly print: (line: string) => void;

  constructor(options: AppOptions = {}) {
    this.print = options.log ?? ((line) => console.log(line));
  }

  get phase(): Phase {
    return this.current;
  }

  get path(): string[] {
    return this.layers.map((layer) => layer.name);
  }

  async use(definition: LayerDefinition): Promise<this> {
    const { name } = definition;

    if (this.current !== "initializing") {
      throw new KernelError(
        "SEALED",
        `layer ${name} cannot be added in phase ${this.current}`,
      );
    }

    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      throw new KernelError("LAYER_NAME", `invalid layer name "${name}"`);
    }

    if (this.layers.some((layer) => layer.name === name)) {
      throw new KernelError(
        "LAYER_DUPLICATE",
        `layer ${name} is already on the path ${this.path.join(" → ")}`,
      );
    }

    const record: LayerRecord = { name, hooks: new Map() };
    this.layers.push(record);

    let active = true;

    try {
      await definition.setup(this.context(record, () => active));
    } catch (error) {
      this.current = "failed";
      throw error;
    } finally {
      active = false;
    }

    return this;
  }

  async start(): Promise<void> {
    if (this.current !== "initializing") {
      throw new KernelError(
        "INVALID_PHASE",
        `start() needs phase initializing, app is ${this.current}`,
      );
    }

    try {
      this.seal();
    } catch (error) {
      this.current = "failed";
      this.restore();
      throw error;
    }

    const touched = new Set<LayerRecord>();

    try {
      for (const { hook, phase } of UP) {
        this.current = phase;

        for (const layer of this.layers) {
          touched.add(layer);
          await this.invoke(layer, hook);
        }
      }

      this.current = "running";
    } catch (error) {
      this.current = "failed";
      await this.unwind(this.layers.filter((layer) => touched.has(layer)));
      this.restore();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.current === "stopped") return;

    if (this.current !== "running") {
      throw new KernelError(
        "INVALID_PHASE",
        `stop() needs phase running, app is ${this.current}`,
      );
    }

    const errors = await this.unwind(this.layers);
    this.restore();
    this.current = "stopped";

    if (errors.length) {
      throw Object.assign(new Error("one or more layers failed to stop"), {
        errors,
      });
    }
  }

  describe(): AppDescription {
    return {
      phase: this.current,
      path: this.path,
      points: [...this.points.values()].map((point) => point.summary()),
    };
  }

  private seal(): void {
    for (const point of this.points.values()) point.seal();
    for (const point of this.points.values()) point.verify();
    for (const { surface, point } of this.surfaces) surface.compose(point.items());
  }

  private restore(): void {
    for (const { surface } of this.surfaces) surface.restore();
  }

  private async unwind(layers: LayerRecord[]): Promise<unknown[]> {
    const errors: unknown[] = [];
    const reversed = [...layers].reverse();

    for (const { hook, phase } of DOWN) {
      if (this.current !== "failed") this.current = phase;

      for (const layer of reversed) {
        try {
          await this.invoke(layer, hook);
        } catch (error) {
          errors.push(error);
          this.print(`[${layer.name}] ${hook} failed: ${String(error)}`);
        }
      }
    }

    return errors;
  }

  private async invoke(layer: LayerRecord, hook: Hook): Promise<void> {
    for (const fn of layer.hooks.get(hook) ?? []) {
      this.trace.push(`${hook}:${layer.name}`);
      await fn();
    }
  }

  private context(layer: LayerRecord, active: () => boolean): LayerContext {
    const { name } = layer;
    const path = this.path;

    const guard = (operation: string) => {
      if (!active()) {
        throw new KernelError(
          "LAYER_INACTIVE",
          `${name} can only ${operation} while its setup is running`,
        );
      }
    };

    const define = <T>(ref: PointRef<T>, definition: PointDefinition<T>) => {
      guard("define");

      if (!ref.id.startsWith(`${name}.`)) {
        throw new KernelError(
          "POINT_NAMESPACE",
          `${name} can only define extension points under "${name}.", got ${ref.id}`,
        );
      }

      if (this.points.has(ref.id)) {
        throw new KernelError(
          "POINT_DUPLICATE",
          `${ref.id} is already defined`,
        );
      }

      const point = new ExtensionPoint<T>(ref.id, name, definition);
      this.points.set(ref.id, point);
      return point;
    };

    const contribute = <T>(ref: PointRef<T>, item: T) => {
      guard("contribute");
      const point = this.points.get(ref.id);

      if (!point) {
        throw new KernelError(
          "POINT_UNKNOWN",
          `${name} cannot contribute to ${ref.id}: no layer on the path ${path.join(" → ")} defines it`,
        );
      }

      if (point.owner === name) {
        throw new KernelError(
          "SELF_CONTRIBUTION",
          `${name} owns ${ref.id}; owners declare builtins instead of contributing`,
        );
      }

      point.add(name, item);
    };

    return {
      name,
      path,
      define,
      contribute,
      provides: (ref) => this.points.has(ref.id),
      open: (functions, description) => {
        guard("open");
        const surface = surfaceOf(functions);
        const point = define(surface.ref, {
          cardinality: "list",
          schema: surface.schema,
          description,
        });
        this.surfaces.push({ surface, point });
      },
      extend: (functions, extension) => {
        guard("extend");
        contribute(surfaceOf(functions).ref, extension);
      },
      on: (hook, fn) => {
        guard(`register a ${hook} hook`);
        layer.hooks.set(hook, [...(layer.hooks.get(hook) ?? []), fn]);
      },
      describe: () => this.describe(),
      log: (message) => this.print(`[${name}] ${message}`),
    };
  }
}

export const createApp = (options?: AppOptions) => new App(options);
