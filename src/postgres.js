const { Sequelize, Model } = require("sequelize");
const config = require("./config");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

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
    console.error(`[NUC] Model directory not found at path: ${seedDir}`);
    return;
  }

  const fileNames = fs.readdirSync(baseDir);

  if (project) {
    const Organization = require("./models/Organization");
    const { seed: companiesSeed } = require("./seeds/Organization.json");

    await Organization.bulkCreate(companiesSeed);

    console.log(`[NUC] Loading internal seed data for Organization`);

    if (fs.existsSync(path.join(seedDir, "Organization.json"))) {
      const seedData = require(path.join(seedDir, "Organization.json"));
      const seed = seedData["seed"];
      const model = require("./models/Organization");
      model.bulkCreate(seed);
      console.log(`[NUC] Loading seed data for Organization`);
    }

    const Project = require("./models/Project");
    const { seed: projectSeed } = require("./seeds/Project.json");

    try {
      const { seed: extProjectSeed } = require(path.join(
        seedDir,
        "Project.json"
      ));

      extProjectSeed && projectSeed.push(...extProjectSeed);

      console.log(
        `[NUC] Loading internal` +
          (extProjectSeed ? ` and external` : "") +
          ` seed data for Project`
      );
    } catch (error) {
      console.log(`[NUC] Loading internal seed data for Project`);
    }

    Project.bulkCreate(projectSeed);
  }

  let fileSequences = [];

  fileNames.forEach((fileName) => {
    if (path.extname(fileName) !== ".js") return;
    if (fileName === "index.js" || fileName === "models.js") return;

    let seedName = `${fileName.split(".")[0]}`;
    const seederPath = path.join(seedDir, `${seedName}.json`);

    if (fs.existsSync(seederPath)) {
      let seedData = require(seederPath);
      fileSequences.push({ sequence: seedData.sequence, fileName });
    }
  });

  fileSequences
    .sort((a, b) => a.sequence - b.sequence)
    .forEach(async ({ fileName }) => {
      let seedName = `${fileName.split(".")[0]}`;
      const seederPath = path.join(seedDir, `${seedName}.json`);
      const filePath = path.join(baseDir, fileName);

      const model = require(filePath);
      let seedData;

      if (fs.existsSync(seederPath)) {
        seedData = require(seederPath);
        console.log(`[NUC] Loading seed data for ${fileName}`);
      } else {
        console.error(`[NUC] Failed to load seed data from ${seederPath}`);
        return;
      }

      const seed = seedData["seed"];

      await model.bulkCreate(seed);
    });

  if (project) {
    const Permission = require("./models/Permission");
    const { seed: permissionsSeed } = require("./seeds/Permission.json");

    try {
      const { seed: extPermissionsSeed } = require(path.join(
        seedDir,
        "Permission.json"
      ));
      extPermissionsSeed && permissionsSeed.push(...extPermissionsSeed);
      console.log(
        `[NUC] Loading internal and external seed data for Permission`
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
      extSettingsSeed && settingsSeed.push(...extSettingsSeed);
      console.log(`[NUC] Loading internal and external seed data for Settings`);
    } catch (error) {
      console.log(`[NUC] Loading internal seed data for Settings`);
    }

    await Settings.bulkCreate(settingsSeed);
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
