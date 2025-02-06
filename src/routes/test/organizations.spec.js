const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

describe("Organization", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("creates organization", async () => {
    const { body: res } = await request(app)
      .post("/organizations")
      .send({ name: "New Organization" })
      .expect(201);

    deepEqual(res, {
      id: res.id,
      name: "New Organization",
    });
  });

  it("lists organizations", async () => {
    const { body: res } = await request(app).get("/organizations").expect(200);
    deepEqual(res, [
      {
        id: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        name: "Rebellion Coffee Shop",
      },
      {
        id: "1c063446-7e78-432a-a273-34f481d0f0c3",
        name: "Good Galactic Corp.",
      },
      {
        id: "5459ab03-204a-4627-bdde-667b7802cb35",
        name: "Fire Logistics",
      },
    ]);
  });

  it("gets organization by id", async () => {
    const { body: res } = await request(app)
      .get(`/organizations/dfb990bb-81dd-4584-82ce-050eb8f6a12f`)
      .expect(200);
    deepEqual(res, {
      id: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
      name: "Rebellion Coffee Shop",
    });
  });
});
