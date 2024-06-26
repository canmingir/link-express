const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

const { seed: companies } = require("../../seeds/companies");

describe("Company", () => {
  beforeEach(async () => {
    await test.reset();
  });
  it("lists companies", async () => {
    const { body: res } = await request(app).get("/link/companies").expect(200);
    deepEqual(res, companies);
  });
  it("gets company by id", async () => {
    const { body: res } = await request(app)
      .get(`/link/companies/${companies[0].id}`)
      .expect(200);
    deepEqual(res, companies[0]);
  });
});
