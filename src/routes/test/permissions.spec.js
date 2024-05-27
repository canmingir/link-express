const request = require("supertest");
const { app, mock } = require("./initTest");
const Permission = require("../../models/Permission");
const { permissions } = require("../../../seed/permissions.json");
const { equal } = require("assert");

describe("Permissions", () => {
  beforeEach(async () => {
    try {
      await Permission.bulkCreate(permissions);
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
  afterEach(async () => {
    try {
      await Permission.destroy({ truncate: true });
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

  it("should create a new permission", async () => {
    const newPermission = {
      userId: 5,
      itemId: "c7b1e1e1-7e3b-4c2b-8e9d-9e9e9e9e9e9e",
      group: "user",
    };
    mock.onPost("/permissions").reply(201, {
      newPermission,
    });

    const {
      body: { userId, itemId, group },
    } = await request(app).post("/permissions").send(newPermission).expect(201);

    equal(userId, newPermission.userId);
    equal(itemId, newPermission.itemId);
    equal(group, newPermission.group);
  });
  it("should fetch all permissions", async () => {
    mock.onGet("/permissions").reply(200, permissions);

    const { body } = await request(app).get("/permissions/").expect(200);

    equal(Array.isArray(body), true);
    equal(body, permissions);
  });
  it("should fetch a permission by id", async () => {
    const {
      body: { userId, id },
    } = await request(app).get(`/permissions/${permissions[0].id}`).expect(200);

    equal(id, permissions[0].id);
    equal(userId, permissions[0].userId);
  });
  it("should update a permission", async () => {
    const {
      body: { group },
    } = await request(app)
      .put(`/permissions/${permissions[0].id}`)
      .send({
        itemId: "a166cc16-5c76-4aac-819e-118207a5dfa9",
        userId: 100001,
        group: "WOW",
      })
      .expect(200);

    equal(group, "personel");
  });
  it("should delete a permission", async () => {
    const res = await request(app)
      .delete(`/permissions/${permissions[0].id}`)
      .expect(204);

    equal(res.status, 204);
  });
  it("should get permissions by user id", async () => {
    const { body } = await request(app)
      .get(`/permissions/user/${permissions[0].userId}`)
      .expect(200);

    equal(body, permissions[0]);
  });
  it("should get permissions by itemId", async () => {
    const { body } = await request(app)
      .get(`/permissions/item/${permissions[0].itemId}`)
      .expect(200);

    equal(body, permissions[0]);
  });
  it("should return 404 with a message if permission not found", async () => {
    const { text } = await request(app).get(`/permissions/999`).expect(404);
    equal(text, "Permission not found");
  });
});

