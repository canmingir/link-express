const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

describe("Setting", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("get settings by project id", async () => {
    const { body: res } = await request(app)
      .get("/projects/cb16e069-6214-47f1-9922-1f7fe7629525/settings")
      .expect(200);

    deepEqual(res, {
      timeZone: "America/New_York",
    });
  });

  it("updates settings by project id", async () => {
    await request(app)
      .patch("/projects/cb16e069-6214-47f1-9922-1f7fe7629525/settings")
      .send({
        timeZone: "America/Los_Angeles",
      })
      .expect(200);

    const { body: res } = await request(app)
      .get("/projects/cb16e069-6214-47f1-9922-1f7fe7629525/settings")
      .expect(200);

    deepEqual(res, {
      timeZone: "America/Los_Angeles",
    });
  });
});
