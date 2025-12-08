import { Sequelize } from "sequelize-typescript";
import config from "./config";
import path from "path";
import fs from "fs";
import { DBMetrics } from "./metrics/dbMetrics";

const appConfig = config();

const { postgres, project } = appConfig;

const metricsConfig = appConfig.metrics;

if (!postgres) {
  throw new Error("Postgres configuration is required");
}

let dbMetrics: DBMetrics | null = null;

if (metricsConfig && metricsConfig.enabled) {
  dbMetrics = new DBMetrics();
  dbMetrics.startPushgateway(metricsConfig);
}

interface SequelizeOptions {
  metricsTimer?: () => number;
  metricsType?: string;
}

const sequelize = new Sequelize(process.env.PG || postgres.uri, {
  logging: postgres.debug && console.log,
  models: [
    path.join(__dirname, "models/*.model.ts"),
    path.join(process.cwd(), "src/models/[A-Z]*.ts"),
  ],
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: false,
    paranoid: false,
  },
  hooks:
    metricsConfig && metricsConfig.enabled
      ? {
          beforeFind: (options = {}) => {
            const timer = dbMetrics!.dbReadLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "read";
          },
          afterFind: (_result, options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbReadOps.inc();
            }
          },

          beforeCreate: (_instance, options = {}) => {
            const timer = dbMetrics!.dbWriteLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "write";
          },
          afterCreate: (_instance, options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbWriteOps.inc();
            }
          },

          beforeUpdate: (_instance, options = {}) => {
            const timer = dbMetrics!.dbWriteLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "write";
          },
          afterUpdate: (_instance, options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbWriteOps.inc();
            }
          },

          beforeDestroy: (_instance, options = {}) => {
            const timer = dbMetrics!.dbWriteLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "write";
          },
          afterDestroy: (_instance, options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbWriteOps.inc();
            }
          },

          beforeBulkCreate: (_instances, options = {}) => {
            const timer = dbMetrics!.dbWriteLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "write";
          },
          afterBulkCreate: (instances, options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbWriteOps.inc(instances.length || 1);
            }
          },

          beforeBulkUpdate: (_instances, options = {}) => {
            const timer = dbMetrics!.dbWriteLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "write";
          },
          afterBulkUpdate: (_instances, options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbWriteOps.inc(1);
            }
          },

          beforeBulkDestroy: (options = {}) => {
            const timer = dbMetrics!.dbWriteLatency.startTimer();
            (options as SequelizeOptions).metricsTimer = timer;
            (options as SequelizeOptions).metricsType = "write";
          },
          afterBulkDestroy: (options = {}) => {
            const opts = options as SequelizeOptions;
            if (opts?.metricsTimer) {
              opts.metricsTimer();
              dbMetrics!.dbWriteOps.inc(1);
            }
          },
        }
      : {},
});

const seed = async (): Promise<void> => {
  const currentWorkingDirectory = process.cwd();
  const baseDir = path.join(currentWorkingDirectory, "src", "models");
  const seedDir = path.join(currentWorkingDirectory, "src", "seeds");

  if (!fs.existsSync(seedDir)) {
    console.error(`[NUC] Seed directory not found at path: ${seedDir}`);
    return;
  }

  if (!fs.existsSync(baseDir)) {
    console.error(`[NUC] Model directory not found at path: ${baseDir}`);
    return;
  }

  try {
    if (project) {
      const { seed: companiesSeed } = require("./seeds/Organization.json");

      sequelize.models.Organization.bulkCreate(companiesSeed, {
        validate: true,
      });

      console.log(`[NUC] Loading internal seed data for Organization`);

      if (fs.existsSync(path.join(seedDir, "Organization.json"))) {
        const seedData = require(path.join(seedDir, "Organization.json"));
        const seed = seedData["seed"];
        sequelize.models.Organization.bulkCreate(seed, {
          validate: true,
        });
        console.log(`[NUC] Loading seed data for Organization`);
      }

      const { seed: projectSeed } = require("./seeds/Project.json");

      try {
        const { seed: extProjectSeed } = require(path.join(
          seedDir,
          "Project.json"
        ));
        if (extProjectSeed) {
          projectSeed.push(...extProjectSeed);
        }
        console.log(
          `[NUC] Loading internal${
            extProjectSeed ? " and external" : ""
          } seed data for Project`
        );
      } catch (error) {
        console.log(`[NUC] Loading internal seed data for Project`);
      }

      sequelize.models.Project.bulkCreate(projectSeed, {
        validate: true,
      });
    }
    const fileNames = fs.readdirSync(baseDir).filter((fileName) => {
      return !["index.ts"].includes(fileName);
    });

    const fileSequences = fileNames
      .map((fileName) => {
        const seedName = fileName.split(".")[0];
        const seederPath = path.join(seedDir, `${seedName}.json`);

        if (fs.existsSync(seederPath)) {
          const seedData = require(seederPath);
          return { sequence: seedData.sequence, fileName };
        }
        return null;
      })
      .filter(Boolean) as { sequence: number; fileName: string }[];

    fileSequences.sort((a, b) => a.sequence - b.sequence);

    for (const { fileName } of fileSequences) {
      const seedName = fileName.split(".")[0];
      const seederPath = path.join(seedDir, `${seedName}.json`);

      try {
        const seedData = require(seederPath);
        const seed = seedData["seed"];

        console.log(`[NUC] Loading seed data for ${fileName}`);

        await sequelize.model(seedName).bulkCreate(seed, {
          validate: true,
        });
      } catch (error) {
        console.error(`[NUC] Error loading seed data for ${fileName}:`, error);
        throw error;
      }
    }

    if (project) {
      const { seed: permissionsSeed } = require("./seeds/Permission.json");
      try {
        const { seed: extPermissionsSeed } = require(path.join(
          seedDir,
          "Permission.json"
        ));
        if (extPermissionsSeed) {
          permissionsSeed.push(...extPermissionsSeed);
        }
        console.log(
          `[NUC] Loading internal${
            extPermissionsSeed ? " and external" : ""
          } seed data for Permission`
        );
      } catch (error) {
        console.log(`[NUC] Loading internal seed data for Permission`);
      }

      sequelize.models.Permission.bulkCreate(permissionsSeed, {
        validate: true,
      });

      const { seed: settingsSeed } = require("./seeds/Settings.json");

      try {
        const { seed: extSettingsSeed } = require(path.join(
          seedDir,
          "Settings.json"
        ));
        if (extSettingsSeed) {
          settingsSeed.push(...extSettingsSeed);
        }
        console.log(
          `[NUC] Loading internal${
            extSettingsSeed ? " and external" : ""
          } seed data for Settings`
        );
      } catch (error) {
        console.log(`[NUC] Loading internal seed data for Settings`);
      }

      sequelize.models.Settings.bulkCreate(settingsSeed, {
        validate: true,
      });
    }
  } catch (error) {
    console.error("[NUC] Error during seed operation:", error);
    throw error;
  }
};

const associateModels = async (): Promise<void> => {
  const models = await import("./models");
  await models.init();
};

if (postgres.sync) {
  setImmediate(async () => {
    project && (await associateModels());
    await sequelize.sync({ force: true });
    await seed();
  });
}

export { sequelize };
