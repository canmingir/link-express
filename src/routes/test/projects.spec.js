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
    const { body: res } = await request(app)
      .post("/projects")
      .send({
        name: "NEW Imagine Coffee Shop",
        description: "NEW A coffee shop that serves the best coffee in town.",
        icon: ":NEWcoffee:",
      })
      .expect(201);
    console.log(res);
  });

  it("lists projects", async () => {
    const { body: res } = await request(app).get("/projects").expect(200);
    deepEqual(res, [
      {
        id: "cb16e069-6214-47f1-9922-1f7fe7629525",
        name: "Imagine Coffee Shop",
        icon: ":coffee:",
        description: "A coffee shop that serves the best coffee in town.",
        type: "SINGLE",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        coach: null,
      },
      {
        id: "add6dfa4-45ba-4da2-bc5c-5a529610b52f",
        name: "Imagine Coffee Shop Team",
        coach: "Elijah",
        icon: ":beans:",
        description: null,
        type: null,
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
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
      icon: ":beans:",
      organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
      type: null,
      description: null,
    });
  });

  it("get project by id forbidden", async () => {
    await request(app)
      .get("/projects/21d2530b-4657-4ac0-b8cd-1a9f82786e32")
      .expect(404);
  });
  it("update project", async () => {
    const { body: res } = await request(app)
      .patch("/projects/add6dfa4-45ba-4da2-bc5c-5a529610b52f")
      .send({
        name: "Updated Imagine Coffee Shop Team",
        coach: "updated Elijah",
        icon: ":NEWbeans:",
      })
      .expect(200);
    deepEqual(res, {
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
  });
});
