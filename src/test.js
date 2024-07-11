require("dotenv").config({ path: ".env.test" });
const path = require("path");
const fs = require("fs");

const platform = require("./platform");

platform
  .init({
    postgres: { uri: "sqlite::memory:", debug: true },
    dynamodb: {
      region: "us-test-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    },
  })
  .then(async () => {
    await models.init();
  });

const workingDir = process.cwd();

const modelsDir = path.join(workingDir, "src", "models");
const seedsDir = path.join(workingDir, "src", "seeds");

const models = require(modelsDir);

function project(id) {
  process.env.PROJECT_ID = id;
}

async function reset() {
  const {
    Postgres: { sequelize },
  } = platform.module();

  await sequelize.sync({ force: true });

  const { Project, Organization, Permission } = require("./models");
  await Project.destroy({ truncate: true });

  const modelFileNames = fs.readdirSync(modelsDir);

  modelFileNames.forEach(async (fileName) => {
    if (fileName === "index.js") return;
    if (fileName === "models.js") return;
    const model = require(path.join(modelsDir, fileName));

    await model.destroy({ truncate: true });
  });

  async function seed() {
    const { seed: projects } = require("./seeds/projects.json");
    const { seed: organizations } = require("./seeds/organizations.json");
    const { seed: permissions } = require("./seeds/permissions.json");

    await Organization.bulkCreate(organizations);
    await Project.bulkCreate(projects);

    const seedFileNames = fs.readdirSync(seedsDir);
    let orderedSeeds = [];

    seedFileNames.forEach(async (seedFileName) => {
      if (seedFileName === "index.js") return;

      const { sequence, seed } = require(path.join(seedsDir, seedFileName));
      const modelName =
        seedFileName.charAt(0).toUpperCase() +
        seedFileName.slice(1).split(".")[0].split("s")[0];
      orderedSeeds.push({ sequence, seed, modelName });
    });

    orderedSeeds
      .sort((a, b) => a.sequence - b.sequence)
      .forEach(async ({ seed, modelName }) => {
        const model = require(path.join(modelsDir, modelName));
        await model.bulkCreate(seed);
      });

    await Permission.bulkCreate(permissions);
  }

  await seed();
}

module.exports = { reset, project };
