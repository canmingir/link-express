const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

describe("Organization", () => {
  beforeEach(async () => {
    await test.reset();
  });
  it("lists organizations", async () => {
    const { body: res } = await request(app).get("/organizations").expect(200);
    deepEqual(res, organizations);
  });
  it("gets organization by id", async () => {
    const { body: res } = await request(app)
      .get(`/organizations/${organizations[0].id}`)
      .expect(200);
    deepEqual(res, organizations[0]);
  });
});

