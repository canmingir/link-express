const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual, equal, ok } = require("assert");

describe("Permissions", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("creates permission", async () => {
    const {
      body: { id, projectId, userId, companyId, role },
    } = await request(app)
      .post("/permissions")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        companyId: "1c063446-7e78-432a-a273-34f481d0f0c3",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "lucas@imaginecoffee.shop",
        role: "OWNER",
      })
      .expect(201);

    ok(id);
    equal(companyId, "1c063446-7e78-432a-a273-34f481d0f0c3");
    equal(projectId, "cb16e069-6214-47f1-9922-1f7fe7629525");
    equal(userId, "lucas@imaginecoffee.shop");
    equal(role, "OWNER");
  });

  it("lists permissions by appId, projectId and userId", async () => {
    const { body: permissions } = await request(app)
      .get("/permissions")
      .query({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        companyId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "liam@imaginecoffee.shop",
      })
      .expect(200);

    deepEqual(permissions, [
      {
        id: "e81887da-d05f-4959-9def-6cd137857088",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        companyId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "liam@imaginecoffee.shop",
        role: "OWNER",
      },
    ]);
  });

  it("deletes permission", async () => {
    await request(app)
      .delete(`/permissions/e81887da-d05f-4959-9def-6cd137857088`)
      .expect(204);

    const { body: permissions } = await request(app).get("/permissions").query({
      appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
      projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
      userId: "liam@imaginecoffee.shop",
    });

    ok(!permissions.length);
  });
});
