require("dotenv").config({ path: ".env.test" });
const path = require("path");

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

async function reset(serviceLabel) {
  const {
    Postgres: { sequelize },
  } = platform.module();

  await sequelize.sync({ force: true });

  const { Project } = require("./models");
  const Service = require(path.join(
    modelsDir,
    serviceLabel.charAt(0).toUpperCase() + serviceLabel.slice(1)
  ));

  await Project.destroy({ truncate: true });
  await Service.destroy({ truncate: true });

  async function seed() {
    const { seed: projects } = require("./seeds/projects.json");
    const { seed: serviceSeed } = require(path.join(
      seedsDir,
      `${serviceLabel}s.json`
    ));

    await Project.bulkCreate(projects);
    await Service.bulkCreate(serviceSeed);
  }

  await seed();
}

module.exports = { reset, project };

