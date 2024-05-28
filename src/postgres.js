const { Sequelize, Model } = require("sequelize");
const config = require("./config");
const path = require("path");
const fs = require("fs");

const {
  postgres: { uri, debug = false, sync },
} = config();

const originalDestroy = Model.prototype.destroy;

Model.prototype.destroy = function (options = {}) {
  return originalDestroy.call(this, {
    ...options,
    individualHooks: true,
  });
};

const sequelize = new Sequelize(process.env.PG || uri, {
  logging: debug,
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
    console.log(
      `\x1b[31m[PE] Seed directory not found at path: ${seedDir}\x1b[0m`
    );
    return;
  }

  if (!fs.existsSync(baseDir)) {
    console.log(
      `\x1b[31m[PE] Model directory not found at path: ${baseDir}\x1b[0m`
    );
    return;
  }

  const fileNames = fs.readdirSync(baseDir);

  const baseInternalModelDir = path.join(__dirname, "models");
  const internalSeedDir = path.join(__dirname, "..", "seeds");
  const internalFileNames = fs.readdirSync(baseInternalModelDir);

  internalFileNames.forEach(async (fileName) => {
    if (path.extname(fileName) !== ".js") return;
    if (fileName === "index.js" || fileName === "models.js") return;

    let seedName = `${fileName.toLowerCase().split(".")[0]}s`;
    const seederPath = path.join(seedDir, `${seedName}.json`);
    const filePath = path.join(baseInternalModelDir, fileName);

    const model = require(filePath);
    let seedData;

    if (fs.existsSync(seederPath)) {
      seedData = require(seederPath);
      console.log(`\x1b[32m[PE] Loading seed data for ${fileName}\x1b[0m`);
    } else {
      console.log(
        `\x1b[33m[PE] Unable to locate external seed data for ${fileName}. Falling back to use internal seed data.\x1b[0m`
      );
      seedData = require(path.join(internalSeedDir, `${seedName}.json`));
    }

    const seed = seedData[seedName];

    await model.bulkCreate(seed);
  });

  fileNames.forEach(async (fileName) => {
    if (path.extname(fileName) !== ".js") return;
    if (fileName === "index.js" || fileName === "models.js") return;

    let seedName = `${fileName.toLowerCase().split(".")[0]}s`;
    const seederPath = path.join(seedDir, `${seedName}.json`);
    const filePath = path.join(baseDir, fileName);

    const model = require(filePath);
    let seedData;

    if (fs.existsSync(seederPath)) {
      seedData = require(seederPath);
      console.log(`\x1b[32m[PE] Loading seed data for ${fileName}\x1b[0m`);
    } else {
      console.log(
        `\x1b[31m[PE] Failed to load seed data from ${seederPath}\x1b[0m`
      );
      return;
    }

    const seed = seedData[seedName];

    await model.bulkCreate(seed);
  });
};

if (sync) {
  setImmediate(async () => {
    await sequelize.sync({ force: true });
    await seed();
  });
}

module.exports = { sequelize };
