const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const { deepEqual } = require("assert");

describe("Permissions", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("creates permission", async () => {
    const {
      body: { id },
    } = await request(app)
      .post("/permissions")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "1c063446-7e78-432a-a273-34f481d0f0c3",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "marcus@nucleoidai.com",
        role: "OWNER",
      })
      .expect(201);

    const { body: permission } = await request(app)
      .get(`/permissions`)
      .expect(200);

    deepEqual(permission, [
      {
        id: "e81887da-d05f-4959-9def-6cd137857088",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "1001",
        role: "OWNER",
      },
      {
        id: "f81887da-d05f-4959-9def-6cd137857099",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "github_1001",
        role: "OWNER",
      },
      {
        id: "a1b60c53-66e2-4034-8654-38b83577f279",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "49736917",
        role: "OWNER",
      },
      {
        id: "38b1cc0c-46d8-4f95-9be9-0df1a6c91d7b",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "54210920",
        role: "OWNER",
      },
      {
        id: "7f7bd2c8-3c27-455c-814e-1874e96246ed",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "90180086",
        role: "OWNER",
      },

      {
        id,
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "marcus@nucleoidai.com",
        role: "ADMIN",
      },
    ]);
  });

  it("lists permissions", async () => {
    const { body: permissions } = await request(app)
      .get("/permissions")
      .expect(200);

    deepEqual(permissions, [
      {
        id: "e81887da-d05f-4959-9def-6cd137857088",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "1001",
        role: "OWNER",
      },
      {
        id: "f81887da-d05f-4959-9def-6cd137857099",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "github_1001",
        role: "OWNER",
      },
      {
        id: "a1b60c53-66e2-4034-8654-38b83577f279",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "49736917",
        role: "OWNER",
      },
      {
        id: "38b1cc0c-46d8-4f95-9be9-0df1a6c91d7b",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "54210920",
        role: "OWNER",
      },
      {
        id: "7f7bd2c8-3c27-455c-814e-1874e96246ed",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "90180086",
        role: "OWNER",
      },
    ]);
  });

  it("deletes permission by userId", async () => {
    await request(app).delete(`/permissions/1001`).expect(204);

    await request(app).get("/permissions/1001").expect(404);

    const { body: permissions } = await request(app)
      .get("/permissions")
      .expect(200);

    deepEqual(permissions, [
      {
        id: "f81887da-d05f-4959-9def-6cd137857099",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "github_1001",
        role: "OWNER",
      },
      {
        id: "a1b60c53-66e2-4034-8654-38b83577f279",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "49736917",
        role: "OWNER",
      },
      {
        id: "38b1cc0c-46d8-4f95-9be9-0df1a6c91d7b",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "54210920",
        role: "OWNER",
      },
      {
        id: "7f7bd2c8-3c27-455c-814e-1874e96246ed",
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        userId: "90180086",
        role: "OWNER",
      },
    ]);
  });
});
