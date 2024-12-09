const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

describe("Setting", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("lists settings", async () => {
    const { body: res } = await request(app)
      .get("/projects/cb16e069-6214-47f1-9922-1f7fe7629525/settings")
      .expect(200);

    deepEqual(res, [
      {
        id: "97e74ee6-8967-478d-bf53-d1da8daecb52",
        teamId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        settings: {
          timeZone: "America/New_York",
        },
      },
    ]);
  });

  it("updates settings", async () => {
    const { body: res } = await request(app)
      .patch("/projects/cb16e069-6214-47f1-9922-1f7fe7629525/settings")
      .send({
        settings: {
          timeZone: "America/Los_Angeles",
        },
      })
      .expect(200);

    deepEqual(res, {
      id: "97e74ee6-8967-478d-bf53-d1da8daecb52",
      teamId: "cb16e069-6214-47f1-9922-1f7fe7629525",
      settings: {
        timeZone: "America/Los_Angeles",
      },
    });
  });
});
