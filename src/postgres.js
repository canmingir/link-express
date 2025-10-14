const { Sequelize, Model } = require("sequelize");

const config = require("./config");
const path = require("path");
const fs = require("fs");
const { DBMetrics } = require("./metrics/dbMetrics");

const {
  postgres: { uri, debug = false, sync },
  project,
  pushGateway,
} = config();

const metrics = new DBMetrics();

metrics.startPushgateway(pushGateway);

const originalDestroy = Model.prototype.destroy;

Model.prototype.destroy = function (options = {}) {
  return originalDestroy.call(this, {
    ...options,
    individualHooks: true,
  });
};

const sequelize = new Sequelize(process.env.PG || uri, {
  logging: debug && console.log,
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: false,
    paranoid: false,
  },
  hooks: {
    beforeFind: (options) => {
      const timer = metrics.dbReadLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "read";
    },
    afterFind: (result, options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbReadOps.inc();
      }
    },

    beforeCreate: (instance, options) => {
      const timer = metrics.dbWriteLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "write";
    },
    afterCreate: (instance, options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbWriteOps.inc();
      }
    },

    beforeUpdate: (instance, options) => {
      const timer = metrics.dbWriteLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "write";
    },
    afterUpdate: (instance, options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbWriteOps.inc();
      }
    },

    beforeDestroy: (instance, options) => {
      const timer = metrics.dbWriteLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "write";
    },
    afterDestroy: (instance, options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbWriteOps.inc();
      }
    },

    beforeBulkCreate: (instances, options) => {
      const timer = metrics.dbWriteLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "write";
    },
    afterBulkCreate: (instances, options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbWriteOps.inc(instances.length || 1);
      }
    },

    beforeBulkUpdate: (instances, options) => {
      const timer = metrics.dbWriteLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "write";
    },
    afterBulkUpdate: (instances, options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbWriteOps.inc(instances.length || 1);
      }
    },

    beforeBulkDestroy: (options) => {
      const timer = metrics.dbWriteLatency.startTimer();
      options.metricsTimer = timer;
      options.metricsType = "write";
    },
    afterBulkDestroy: (options) => {
      if (options?.metricsTimer) {
        options.metricsTimer();
        metrics.dbWriteOps.inc(1);
      }
    },
  },
});

const seed = async () => {
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

  let transaction = await sequelize.transaction();

  try {
    if (project) {
      const Organization = require("./models/Organization");
      const { seed: companiesSeed } = require("./seeds/Organization.json");

      await Organization.bulkCreate(companiesSeed, {
        transaction,
        validate: true,
      });
      console.log(`[NUC] Loading internal seed data for Organization`);

      if (fs.existsSync(path.join(seedDir, "Organization.json"))) {
        const seedData = require(path.join(seedDir, "Organization.json"));
        const seed = seedData["seed"];
        await Organization.bulkCreate(seed, {
          transaction,
          validate: true,
        });
        console.log(`[NUC] Loading seed data for Organization`);
      }

      const Project = require("./models/Project");
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

      await Project.bulkCreate(projectSeed, {
        transaction,
        validate: true,
      });
    }

    const fileNames = fs
      .readdirSync(baseDir)
      .filter(
        (fileName) =>
          path.extname(fileName) === ".js" &&
          !["index.js", "models.js"].includes(fileName)
      );

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
      .filter(Boolean)
      .sort((a, b) => a.sequence - b.sequence);

    for (const { fileName } of fileSequences) {
      const seedName = fileName.split(".")[0];
      const seederPath = path.join(seedDir, `${seedName}.json`);
      const filePath = path.join(baseDir, fileName);

      try {
        const model = require(filePath);
        const seedData = require(seederPath);
        const seed = seedData["seed"];

        console.log(`[NUC] Loading seed data for ${fileName}`);
        await model.bulkCreate(seed, {
          transaction,
          validate: true,
        });
      } catch (error) {
        console.error(`[NUC] Error loading seed data for ${fileName}:`, error);
        throw error;
      }
    }

    if (project) {
      const Permission = require("./models/Permission");
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

      await Permission.bulkCreate(permissionsSeed, {
        transaction,
        validate: true,
      });

      const Settings = require("./models/Settings");
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

      await Settings.bulkCreate(settingsSeed, {
        transaction,
        validate: true,
      });
    }

    await transaction.commit();
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("[NUC] Error during seed operation:", error);
    throw error;
  }
};

const associateModels = async () => {
  const models = require("./models");
  await models.init();
};

if (sync) {
  setImmediate(async () => {
    project && (await associateModels());
    await sequelize.sync({ force: true });
    await seed();
  });
}

module.exports = { sequelize, metrics };
