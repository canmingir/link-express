import "express-async-errors";
import http from "http";
import Joi from "joi";
import type { Application, RequestHandler, Router } from "express";
import type { ModelCtor, Sequelize } from "sequelize-typescript";
import { type App, createApp, KernelError, type LayerDefinition, point } from "../kernel";
import * as configModule from "../config";
import type { Config } from "../config";
import { createSequelize, internalModels, seed, type Seed } from "../database";
import * as error from "../error";
import { event as client } from "../event/client";
import type { EventPayload, InitOptions } from "../event/client";
import * as platform from "../platform";

interface Route {
  path: string;
  router: Router;
  public?: boolean;
}

interface Middleware {
  name: string;
  handler: RequestHandler;
}

interface Subscription {
  type: string;
  handler: (payload: any) => unknown;
}

interface EventBus {
  name: string;
  init(options: InitOptions): Promise<void>;
  publish(type: string, payload: EventPayload): Promise<void>;
  subscribe(type: string, handler: (payload: any) => unknown): Promise<unknown>;
  disconnect(): Promise<void>;
}

interface NavItem {
  id: string;
  title: string;
  path: string;
  icon?: string;
  order?: number;
}

interface LinkConfig extends Partial<Config> {
  event?: InitOptions;
  server?: { port?: number; listen?: boolean };
  quiet?: boolean;
}

const points = {
  routes: point<Route>("link.routes"),
  middleware: point<Middleware>("link.middleware"),
  models: point<ModelCtor>("link.models"),
  seeds: point<Seed>("link.seeds"),
  events: point<Subscription>("link.events"),
  eventBus: point<EventBus>("link.eventBus"),
  navigation: point<NavItem>("link.navigation"),
};

const socketBus: EventBus = {
  name: "link-express",
  init: (options) => client.init(options),
  publish: (type, payload) => client.publish(type, payload),
  subscribe: (type, handler) =>
    client.subscribe(type, async (payload) => {
      await handler(payload);
    }),
  disconnect: () => client.disconnect(),
};

let instance: App | null = null;

function claim(create: () => App): App {
  if (instance && !["stopped", "failed"].includes(instance.phase)) {
    throw new KernelError(
      "INSTANCE_EXISTS",
      `an app is already ${instance.phase} on the path ${instance.path.join(" → ")}`,
    );
  }

  instance = create();
  return instance;
}

function release(): void {
  instance = null;
}

async function init(config: LinkConfig = {}): Promise<App> {
  const app = claim(() => createApp({ log: config.quiet ? () => {} : undefined }));
  return app.use(layer(config));
}

async function run(app: App): Promise<App> {
  await app.start();

  const shutdown = () =>
    app.stop().then(
      () => process.exit(0),
      (reason) => {
        console.error(reason);
        process.exit(1);
      },
    );

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return app;
}

function signatures(route: Route): string[] {
  const stack = (route.router as unknown as {
    stack?: { route?: { path: string; methods: Record<string, boolean> } }[];
  }).stack ?? [];

  return stack.flatMap((entry) =>
    entry.route
      ? Object.keys(entry.route.methods).map(
          (method) =>
            `${method.toUpperCase()} ${`${route.path}${entry.route!.path}`.replace(/\/$/, "") || "/"}`,
        )
      : [],
  );
}

function layer(config: LinkConfig): LayerDefinition {
  return {
    name: "link",
    setup(ctx) {
      const routes = ctx.define(points.routes, {
        cardinality: "list",
        description:
          "Routers mounted under a prefix; upper layers are mounted before link's own routes and may shadow them",
        schema: Joi.object({
          path: Joi.string()
            .pattern(/^\/[A-Za-z0-9\-/:_]*$/)
            .required(),
          router: Joi.func().required(),
          public: Joi.boolean().default(false),
        }),
      });

      const middleware = ctx.define(points.middleware, {
        cardinality: "keyed",
        description: "Middleware applied to every authenticated route, in contribution order",
        key: (item) => item.name,
        schema: Joi.object({
          name: Joi.string().required(),
          handler: Joi.func().required(),
        }),
      });

      const models = ctx.define(points.models, {
        cardinality: "keyed",
        description: "Sequelize models added to the shared database",
        key: (model) => model.name,
        schema: Joi.func().required(),
      });

      const seeds = ctx.define(points.seeds, {
        cardinality: "list",
        description:
          "Seed rows; Organization, Project, Permission and Settings rows are merged into link's own seeds",
        schema: Joi.object({
          model: Joi.string().required(),
          sequence: Joi.number().required(),
          seed: Joi.array().items(Joi.object().unknown()).required(),
        }),
        validate(handle) {
          const known = new Set([
            "Organization",
            "Project",
            "Permission",
            "Settings",
            ...models.items().map((model) => model.name),
          ]);
          const missing = handle
            .items()
            .map((item) => item.model)
            .filter((model) => !known.has(model));

          if (missing.length) {
            throw new Error(`seeds for unknown models: ${[...new Set(missing)].join(", ")}`);
          }
        },
      });

      const events = ctx.define(points.events, {
        cardinality: "list",
        description: "Event bus subscriptions",
        schema: Joi.object({
          type: Joi.string()
            .pattern(/^[A-Z][A-Z0-9_]*$/)
            .required(),
          handler: Joi.func().required(),
        }),
      });

      const eventBus = ctx.define(points.eventBus, {
        cardinality: "single",
        description: "The event bus implementation; defaults to the link-express event client",
        schema: Joi.object({
          name: Joi.string().required(),
          init: Joi.func().required(),
          publish: Joi.func().required(),
          subscribe: Joi.func().required(),
          disconnect: Joi.func().required(),
        }),
        default: socketBus,
      });

      const navigation = ctx.define(points.navigation, {
        cardinality: "keyed",
        description: "Entries in the UI shell navigation",
        key: (item) => item.id,
        schema: Joi.object({
          id: Joi.string().required(),
          title: Joi.string().required(),
          path: Joi.string().required(),
          icon: Joi.string(),
          order: Joi.number().default(100),
        }),
      });

      let express: Application | undefined;
      let publicRouter: Router | undefined;
      let internalRoutes: Route[] = [];
      let sequelize: Sequelize | undefined;
      let server: http.Server | undefined;
      let connected = false;

      ctx.on("migrate", async () => {
        configModule.init(config as Config);

        const expressModule = await import("../express");
        express = expressModule.default;
        publicRouter = expressModule.publicRouter;
        internalRoutes = expressModule.internalRoutes();

        const logger = config.logger ? (await import("../logger")).default : console;

        let dynamodb: { docClient: import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient } | undefined;

        if (config.dynamodb) {
          dynamodb = { docClient: (await import("../dynamodb")).docClient };
        }

        if (config.postgres) {
          sequelize = createSequelize({
            uri: config.postgres.uri,
            debug: config.postgres.debug,
            models: [...internalModels, ...models.items()],
            metrics: config.metrics,
          });

          if (config.project) {
            await (await import("../models")).init();
          }
        }

        platform.setModules({
          express,
          publicRouter,
          postgres: sequelize ? { sequelize } : undefined,
          dynamodb,
          logger,
        });

        if (sequelize && config.postgres?.sync) {
          await sequelize.sync({ force: true });
        }

        ctx.log(
          `database ready: ${models.items().length} contributed models${config.postgres?.sync ? ", synced" : ""}`,
        );
      });

      ctx.on("seed", async () => {
        if (!sequelize || !config.postgres?.sync) return;

        await seed(sequelize, { project: Boolean(config.project), seeds: seeds.items() });
        ctx.log(`seeded ${seeds.items().length} contributed seed sets`);
      });

      ctx.on("start", async () => {
        const bus = eventBus.value();

        if (config.event) {
          await bus.init(config.event);
          connected = true;
        }

        for (const { type, handler } of events.items()) {
          await bus.subscribe(type, handler);
        }

        for (const { handler } of middleware.items()) {
          express!.use(handler);
        }

        const mounted = [
          ...routes.contributions().map(({ item, layer }) => ({ route: item, layer })),
          ...internalRoutes.map((route) => ({ route, layer: "link" })),
        ];

        const owners = new Map<string, string>();

        for (const { route, layer } of mounted) {
          (route.public ? publicRouter! : express!).use(route.path, route.router);

          for (const signature of signatures(route)) {
            const owner = owners.get(signature);

            if (owner && owner !== layer) {
              ctx.log(`${signature}: ${owner} shadows ${layer}`);
            } else {
              owners.set(signature, layer);
            }
          }
        }

        express!.get("/shell/navigation", (_req, res) => {
          res.json(
            navigation
              .contributions()
              .map(({ layer, item }) => ({ ...item, layer }))
              .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
          );
        });

        express!.get("/shell/extensions", (_req, res) => {
          res.json(ctx.describe());
        });

        express!.use((_req, res) => res.status(404).end());
        express!.use(error.handle);

        ctx.log(
          `mounted ${mounted.length} routers, ${middleware.items().length} middleware, ${events.items().length} subscriptions on ${bus.name}`,
        );
      });

      ctx.on("ready", () => {
        if (config.server?.listen === false) return;

        const port = config.server?.port ?? Number(process.env.PORT ?? 4000);

        return new Promise<void>((resolve, reject) => {
          server = http.createServer(express);
          server.once("error", reject);
          server.listen(port, () => {
            ctx.log(`listening on :${port} (${ctx.describe().path.join(" → ")})`);
            resolve();
          });
        });
      });

      ctx.on("drain", () => {
        return new Promise<void>((resolve) => {
          if (!server) return resolve();
          server.close(() => resolve());
          server.closeIdleConnections();
        });
      });

      ctx.on("stop", async () => {
        if (connected) await eventBus.value().disconnect();
        await sequelize?.close();
        ctx.log("stopped");
      });
    },
  };
}

export { init, points, release, run };
export type { EventBus, LinkConfig, Middleware, NavItem, Route, Subscription };
export * from "../kernel";
