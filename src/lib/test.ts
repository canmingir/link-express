import dotenv from "dotenv";
import platform from "../platform";
import { Sequelize } from "sequelize";

dotenv.config({ path: ".env.test" });

platform.init({
  project: {
    name: "test",
    version: "1.0.0",
    oauth: {
      jwt: {
        identifier: "email",
      },
      providers: {
        github: {
          tokenUrl: "https://github.com/login/oauth/access_token",
          userUrl: "https://api.github.com/user",
          clientId: "0c2844d3d19dc9293fc5",
          redirectUri: "http://localhost:5173/callback",
          userIdentifier: "id",
          userFields: {
            name: "name",
            displayName: "login",
            avatarUrl: "avatar_url",
            email: "email",
          },
        },
      },
    },
  },
  postgres: {
    uri: "sqlite::memory:",
    debug: true,
    sync: false,
  },
});

import { init } from "../models";

async function reset(): Promise<void> {
  const { sequelize }: { sequelize: Sequelize } = await import("../postgres");

  if (await init()) {
    await sequelize.sync({ force: true });
  }

  await sequelize.models.Organization.destroy({ truncate: true });
  await sequelize.models.Project.destroy({ truncate: true });
  await sequelize.models.Permission.destroy({ truncate: true });
  await sequelize.models.Settings.destroy({ truncate: true });

  async function seed(): Promise<void> {
    const { seed: organizations } = await import("../seeds/Organization.json");
    const { seed: permissions } = await import("../seeds/Permission.json");
    const { seed: projects } = await import("../seeds/Project.json");
    const { seed: settings } = await import("../seeds/Settings.json");

    await sequelize.models.Organization.bulkCreate(organizations);
    await sequelize.models.Project.bulkCreate(projects);
    await sequelize.models.Permission.bulkCreate(permissions);
    await sequelize.models.Settings.bulkCreate(settings);
  }

  await seed();
}

export { reset };
