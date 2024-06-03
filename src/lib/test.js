require("dotenv").config({ path: ".env.test" });
const { init } = require("../platform");

init({
  oauth: {
    jwt: {
      identifier: "email",
    },
    tokenUrl: "https://github.com/login/oauth/access_token",
    userUrl: "https://api.github.com/user",
    clientId: "0c2844d3d19dc9293fc5",
    redirectUri: "http://localhost:5173/callback",
  },
  postgres: {
    uri: "sqlite::memory:",
    debug: true,
    sync: true,
  },
});

const models = require("../models");

async function reset() {
  const { sequelize } = require("../postgres");

  await models.init();
  await sequelize.sync({ force: true });

  const Permission = require("../models/Permission");

  await Permission.destroy({ truncate: true });

  async function seed() {
    const { permissions } = require("../seeds/permissions.json");

    await Permission.bulkCreate(permissions);
  }

  await seed();
}

module.exports = { reset };
