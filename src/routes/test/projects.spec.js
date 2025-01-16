const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

describe("Project", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("create project", async () => {
    const { body: project } = await request(app)
      .post("/projects")
      .send({
        name: "NEW Rebellion Coffee Shop",
        description:
          "NEW The finest cantina-style coffee shop this side of Mos Eisley, serving premium caf brewed from beans grown in the forests of Kashyyyk.",
        icon: ":NEWcoffee:",
      })
      .expect(201);

    const { body: projects } = await request(app).get(`/projects`).expect(200);

    deepEqual(projects, [
      {
        id: "cb16e069-6214-47f1-9922-1f7fe7629525",
        name: "Rebellion Coffee Shop",
        icon: ":ph:coffee-bean-duotone:",
        description:
          "The finest cantina-style coffee shop this side of Mos Eisley, serving premium caf brewed from beans grown in the forests of Kashyyyk.",
        type: "SINGLE",
        coach: null,
        organization: {
          id: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
          name: "Rebellion Coffee Shop",
        },
      },
      {
        id: "0c756054-2d28-4f87-9b12-8023a79136a5",
        name: "Good Galactic Corp.",
        icon: ":ph:Galactic-duotone:",
        description:
          "The most trusted Galacticing institution in the Core Worlds, with secure vaults that would impress even the Empire.",
        type: "MULTI",
        coach: null,
        organization: {
          id: "1c063446-7e78-432a-a273-34f481d0f0c3",
          name: "Good Galactic Corp.",
        },
      },
      {
        id: "21d2530b-4657-4ac0-b8cd-1a9f82786e32",
        name: "Fire Logistics",
        icon: ":ph:fire-simple-duotone:",
        description:
          "The fastest cargo haulers in the Outer Rim, making the Kessel Run in under twelve parsecs.",
        type: "SINGLE",
        coach: null,
        organization: {
          id: "5459ab03-204a-4627-bdde-667b7802cb35",
          name: "Fire Logistics",
        },
      },
      {
        id: project.id,
        name: "NEW Rebellion Coffee Shop",
        icon: ":NEWcoffee:",
        description:
          "NEW The finest cantina-style coffee shop this side of Mos Eisley, serving premium caf brewed from beans grown in the forests of Kashyyyk.",
        type: null,
        coach: null,
        organization: {
          id: project.organizationId,
          name: "NEW Rebellion Coffee Shop Org",
        },
      },
    ]);
  });

  it("lists projects", async () => {
    const { body: res } = await request(app).get("/projects").expect(200);
    console.log(res);

    deepEqual(res, [
      {
        id: "cb16e069-6214-47f1-9922-1f7fe7629525",
        name: "Rebellion Coffee Shop",
        icon: ":ph:coffee-bean-duotone:",
        description:
          "The finest cantina-style coffee shop this side of Mos Eisley, serving premium caf brewed from beans grown in the forests of Kashyyyk.",
        type: "SINGLE",
        coach: null,
        organization: {
          id: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
          name: "Rebellion Coffee Shop",
        },
      },
      {
        id: "0c756054-2d28-4f87-9b12-8023a79136a5",
        name: "Good Galactic Corp.",
        icon: ":ph:Galactic-duotone:",
        description:
          "The most trusted Galacticing institution in the Core Worlds, with secure vaults that would impress even the Empire.",
        type: "MULTI",
        coach: null,
        organization: {
          id: "1c063446-7e78-432a-a273-34f481d0f0c3",
          name: "Good Galactic Corp.",
        },
      },
      {
        id: "21d2530b-4657-4ac0-b8cd-1a9f82786e32",
        name: "Fire Logistics",
        icon: ":ph:fire-simple-duotone:",
        description:
          "The fastest cargo haulers in the Outer Rim, making the Kessel Run in under twelve parsecs.",
        type: "SINGLE",
        coach: null,
        organization: {
          id: "5459ab03-204a-4627-bdde-667b7802cb35",
          name: "Fire Logistics",
        },
      },
    ]);
  });

  it("get project by id", async () => {
    const { body: res } = await request(app)
      .get("/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f")
      .expect(200);
    deepEqual(res, {
      id: "add6dfa4-45ba-4da2-bc5c-5a529610b52f",
      name: "Rebellion Coffee Shop Team",
      coach: "Elijah",
      icon: ":ph:coffee-bean-duotone:",
      organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
      type: null,
      description: null,
    });
  });

  it("get project by id forbidden", async () => {
    await request(app)
      .get("/projects/11d2530b-4657-4ac0-b8cd-1a9f82786e32")
      .expect(404);
  });

  it("update project", async () => {
    await request(app)
      .patch("/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f")
      .send({
        name: "Updated Rebellion Coffee Shop Team",
        coach: "updated Elijah",
        icon: ":NEWbeans:",
      })
      .expect(200);

    const { body: updatedProject } = await request(app)
      .get(`/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f`)
      .expect(200);

    deepEqual(updatedProject, {
      id: "add6dfa4-45ba-4da2-bc5c-5a529610b52f",
      name: "Updated Rebellion Coffee Shop Team",
      coach: "updated Elijah",
      icon: ":NEWbeans:",
      organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
      type: null,
      description: null,
    });
  });

  it("delete project", async () => {
    await request(app)
      .delete("/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f")
      .expect(204);

    await request(app)
      .get(`/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f`)
      .expect(404);
  });
});
