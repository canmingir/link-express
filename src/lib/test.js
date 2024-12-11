require("dotenv").config({ path: ".env.test" });
const { init } = require("../platform");

init({
  project: {
    jwt: {
      identifier: "email",
    },
    oauth: {
      tokenUrl: "https://github.com/login/oauth/access_token",
      userUrl: "https://api.github.com/user",
      clientId: "0c2844d3d19dc9293fc5",
      redirectUri: "http://localhost:5173/callback",
    },
  },
  postgres: {
    uri: "sqlite::memory:",
    debug: true,
    sync: false,
  },
});

const models = require("../models");

async function reset() {
  const { sequelize } = require("../postgres");

  if (await models.init()) {
    await sequelize.sync({ force: true });
  }

  const Organization = require("../models/Organization");

  const Project = require("../models/Project");
  const Permission = require("../models/Permission");
  const Settings = require("../models/Settings");

  await Organization.destroy({ truncate: true });
  await Project.destroy({ truncate: true });
  await Permission.destroy({ truncate: true });
  await Settings.destroy({ truncate: true });

  async function seed() {
    const { seed: organizations } = require("../seeds/Organization.json");
    const { seed: permissions } = require("../seeds/Permission.json");
    const { seed: projects } = require("../seeds/Project.json");
    const { seed: settings } = require("../seeds/Settings.json");

    await Organization.bulkCreate(organizations);
    await Project.bulkCreate(projects);
    await Permission.bulkCreate(permissions);
    await Settings.bulkCreate(settings);
  }

  await seed();
}

module.exports = { reset };
