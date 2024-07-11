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

  const { Project } = require("./models");
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
    await Project.bulkCreate(projects);

    modelFileNames.forEach((fileName) => {
      if (fileName === "index.js") return;
      if (fileName === "models.js") return;

      const seedFileName = `${fileName.split(".")[0]}s.json`;

      const { seed } = require(path.join(seedsDir, seedFileName));
      const model = require(path.join(modelsDir, fileName));

      model.bulkCreate(seed);
    });
  }

  await seed();
}

module.exports = { reset, project };
