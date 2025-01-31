const { Sequelize, Model } = require("sequelize");
const config = require("./config");
const path = require("path");
const fs = require("fs");

const {
  postgres: { uri, debug = false, sync },
  project,
} = config();

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

  try {
    if (project) {
      const Organization = require("./models/Organization");
      const { seed: companiesSeed } = require("./seeds/Organization.json");
      await Organization.bulkCreate(companiesSeed);
      console.log(`[NUC] Loading internal seed data for Organization`);

      if (fs.existsSync(path.join(seedDir, "Organization.json"))) {
        const seedData = require(path.join(seedDir, "Organization.json"));
        const seed = seedData["seed"];
        await Organization.bulkCreate(seed);
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

      await Project.bulkCreate(projectSeed);
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
        await model.bulkCreate(seed);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[NUC] Error loading seed data for ${fileName}:`, error);
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

      await Permission.bulkCreate(permissionsSeed);

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

      await Settings.bulkCreate(settingsSeed);
    }
  } catch (error) {
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

module.exports = { sequelize };
