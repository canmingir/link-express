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
  const seedDir = path.join(currentWorkingDirectory, "src", "seed");
  const fileNames = fs.readdirSync(baseDir);

  const baseInternalModelDir = path.join(__dirname, "models");
  const internalSeedDir = path.join(__dirname, "..", "seed");
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
    } else {
      console.info(
        `Unable to locate external seed data at path: ${seederPath}. Falling back to use internal seed data.`
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
    } else {
      console.error(`Failed to load seed data from ${seederPath}`);
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

