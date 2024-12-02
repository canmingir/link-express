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
        name: "NEW Imagine Coffee Shop",
        description: "NEW A coffee shop that serves the best coffee in town.",
        icon: ":NEWcoffee:",
      })
      .expect(201);

    const { body: projects } = await request(app).get(`/projects`).expect(200);

    deepEqual(projects, [
      {
        id: "cb16e069-6214-47f1-9922-1f7fe7629525",
        name: "Imagine Coffee Shop",
        icon: ":ph:coffee-bean-duotone:",
        description: "A coffee shop that serves the best coffee in town.",
        type: "SINGLE",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        coach: null,
        Organization: {
          id: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
          name: "Imagine Coffee Shop",
        },
      },
      {
        id: "0c756054-2d28-4f87-9b12-8023a79136a5",
        name: "Good Bank Corp.",
        icon: ":ph:bank-duotone:",
        description: "The best bank on the planet.",
        type: "MULTI",
        organizationId: "1c063446-7e78-432a-a273-34f481d0f0c3",
        coach: null,
        Organization: {
          id: "1c063446-7e78-432a-a273-34f481d0f0c3",
          name: "Good Bank Corp.",
        },
      },
      {
        id: "21d2530b-4657-4ac0-b8cd-1a9f82786e32",
        name: "Fire Logistics",
        icon: ":ph:fire-simple-duotone:",
        description: "A logistics organization that delivers goods on time.",
        type: "SINGLE",
        organizationId: "5459ab03-204a-4627-bdde-667b7802cb35",
        coach: null,
        Organization: {
          id: "5459ab03-204a-4627-bdde-667b7802cb35",
          name: "Fire Logistics",
        },
      },
      {
        id: project.id,
        name: "NEW Imagine Coffee Shop",
        icon: ":NEWcoffee:",
        description: "NEW A coffee shop that serves the best coffee in town.",
        type: null,
        organizationId: project.organizationId,
        coach: null,
        Organization: {
          id: project.organizationId,
          name: "NEW Imagine Coffee Shop Org",
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
        name: "Imagine Coffee Shop",
        icon: ":ph:coffee-bean-duotone:",
        description: "A coffee shop that serves the best coffee in town.",
        type: "SINGLE",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        coach: null,
        Organization: {
          id: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
          name: "Imagine Coffee Shop",
        },
      },
      {
        id: "0c756054-2d28-4f87-9b12-8023a79136a5",
        name: "Good Bank Corp.",
        icon: ":ph:bank-duotone:",
        description: "The best bank on the planet.",
        type: "MULTI",
        organizationId: "1c063446-7e78-432a-a273-34f481d0f0c3",
        coach: null,
        Organization: {
          id: "1c063446-7e78-432a-a273-34f481d0f0c3",
          name: "Good Bank Corp.",
        },
      },
      {
        id: "21d2530b-4657-4ac0-b8cd-1a9f82786e32",
        name: "Fire Logistics",
        icon: ":ph:fire-simple-duotone:",
        description: "A logistics organization that delivers goods on time.",
        type: "SINGLE",
        organizationId: "5459ab03-204a-4627-bdde-667b7802cb35",
        coach: null,
        Organization: {
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
      name: "Imagine Coffee Shop Team",
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
        name: "Updated Imagine Coffee Shop Team",
        coach: "updated Elijah",
        icon: ":NEWbeans:",
      })
      .expect(200);

    const { body: updatedProject } = await request(app)
      .get(`/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f`)
      .expect(200);

    deepEqual(updatedProject, {
      id: "add6dfa4-45ba-4da2-bc5c-5a529610b52f",
      name: "Updated Imagine Coffee Shop Team",
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
