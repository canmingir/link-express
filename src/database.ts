import path from "path";
import type { InstanceDestroyOptions } from "sequelize";
import {
  Model,
  type ModelCtor,
  Sequelize,
  type SequelizeOptions,
} from "sequelize-typescript";
import type { Config } from "./config";
import { DBMetrics } from "./metrics/dbMetrics";

interface MetricsTimed {
  metricsTimer?: () => number;
  metricsType?: string;
}

interface Seed {
  model: string;
  sequence: number;
  seed: Record<string, unknown>[];
}

const originalDestroy = Model.prototype.destroy;
Model.prototype.destroy = async function (
  options?: InstanceDestroyOptions,
): Promise<void> {
  return originalDestroy.call(this, {
    ...options,
    individualHooks: true,
  }) as Promise<void>;
};

const internalModels = [
  path.join(__dirname, "models/*.model.js"),
  path.join(__dirname, "models/*.model.ts"),
];

function metricsHooks(
  dbMetrics: DBMetrics,
): NonNullable<SequelizeOptions["hooks"]> {
  const start = (options: object, type: "read" | "write") => {
    const timed = options as MetricsTimed;
    timed.metricsTimer = (
      type === "read" ? dbMetrics.dbReadLatency : dbMetrics.dbWriteLatency
    ).startTimer();
    timed.metricsType = type;
  };

  const end = (options: object, type: "read" | "write", count = 1) => {
    const timed = options as MetricsTimed;
    if (timed?.metricsTimer) {
      timed.metricsTimer();
      (type === "read" ? dbMetrics.dbReadOps : dbMetrics.dbWriteOps).inc(
        count,
      );
    }
  };

  return {
    beforeFind: (options = {}) => start(options, "read"),
    afterFind: (_result, options = {}) => end(options, "read"),
    beforeCreate: (_instance, options = {}) => start(options, "write"),
    afterCreate: (_instance, options = {}) => end(options, "write"),
    beforeUpdate: (_instance, options = {}) => start(options, "write"),
    afterUpdate: (_instance, options = {}) => end(options, "write"),
    beforeDestroy: (_instance, options = {}) => start(options, "write"),
    afterDestroy: (_instance, options = {}) => end(options, "write"),
    beforeBulkCreate: (_instances, options = {}) => start(options, "write"),
    afterBulkCreate: (instances, options = {}) =>
      end(options, "write", instances.length || 1),
    beforeBulkUpdate: (options) => start(options, "write"),
    afterBulkUpdate: (options) => end(options, "write"),
    beforeBulkDestroy: (options) => start(options, "write"),
    afterBulkDestroy: (options) => end(options, "write"),
  };
}

function createSequelize({
  uri,
  debug,
  models,
  metrics,
}: {
  uri: string;
  debug?: boolean;
  models: (string | ModelCtor)[];
  metrics?: Config["metrics"];
}): Sequelize {
  let hooks: SequelizeOptions["hooks"] = {};

  if (metrics && metrics.enabled) {
    const dbMetrics = new DBMetrics();
    dbMetrics.startPushgateway(metrics);
    hooks = metricsHooks(dbMetrics);
  }

  const paths = models.filter((model): model is string => typeof model === "string");
  const classes = models.filter((model): model is ModelCtor => typeof model !== "string");

  const sequelize = new Sequelize(process.env.PG || uri, {
    logging: debug && console.log,
    models: paths,
    define: {
      freezeTableName: true,
      underscored: true,
      timestamps: false,
      paranoid: false,
    },
    hooks,
  });

  if (classes.length) sequelize.addModels(classes);

  return sequelize;
}

async function seed(
  sequelize: Sequelize,
  { project, seeds }: { project: boolean; seeds: Seed[] },
): Promise<void> {
  const reserved = ["Organization", "Project", "Permission", "Settings"];

  const rows = (model: string) =>
    seeds.filter((item) => item.model === model).flatMap((item) => item.seed);

  const internal = (model: string): Record<string, unknown>[] =>
    require(`./seeds/${model}.json`).seed;

  const create = async (model: string, data: Record<string, unknown>[]) => {
    if (!data.length) return;
    await sequelize.model(model).bulkCreate(data, { validate: true });
  };

  if (project) {
    await create("Organization", [...internal("Organization"), ...rows("Organization")]);
    await create("Project", [...internal("Project"), ...rows("Project")]);
  }

  const ordered = seeds
    .filter((item) => !reserved.includes(item.model))
    .sort((a, b) => a.sequence - b.sequence);

  for (const item of ordered) {
    await create(item.model, item.seed);
  }

  if (project) {
    await create("Permission", [...internal("Permission"), ...rows("Permission")]);
    await create("Settings", [...internal("Settings"), ...rows("Settings")]);
  }
}

export { createSequelize, internalModels, metricsHooks, seed };
export type { Seed };
