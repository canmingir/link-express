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
    const internalModels = require("./models/index");

    await models.init();
    await internalModels.init();
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
    if (["index.js", "index.ts", "models.js", "models.ts"].includes(fileName)) {
      return;
    }

    try {
      const model = require(path.join(modelsDir, fileName));
      await model.destroy({ truncate: true });
    } catch (err) {
      // Empty
    }
  });

  async function seed() {
    const { seed: organizations } = require("./seeds/Organization.json");
    const { seed: projects } = require("./seeds/Project.json");
    const { seed: permissions } = require("./seeds/Permission.json");

    const { seed: extProjectSeed } = require(path.join(
      seedsDir,
      "Project.json"
    ));

    await Organization.bulkCreate(organizations);

    const allProjects = extProjectSeed
      ? [...projects, ...extProjectSeed]
      : projects;

    console.log("All Projects", allProjects);

    await Project.bulkCreate(allProjects);

    const seedFileNames = fs.readdirSync(seedsDir);
    let orderedSeeds = [];

    seedFileNames.forEach(async (seedFileName) => {
      if (seedFileName === "index.js") return;

      const { sequence, seed } = require(path.join(seedsDir, seedFileName));
      const modelName = seedFileName.split(".")[0];
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
