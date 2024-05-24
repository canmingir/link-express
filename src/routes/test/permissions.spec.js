const request = require("supertest");
const { app } = require("./initTest");
const Permission = require("../../models/Permission");
const { permissions } = require("../../../seed/permissions.json");
const { equal } = require("assert");

describe("Permissions", () => {
  beforeEach(async () => {
    await Permission.bulkCreate(permissions);
  });

  it("should create a new permission", async () => {
    const newPermission = {
      userId: 2,
      itemId: "c7b1e1e1-7e3b-4c2b-8e9d-9e9e9e9e9e9e",
      group: "user",
    };
    const {
      body: { userId, itemId, group },
    } = await request(app).post("/permissions").send(newPermission).expect(201);

    equal(userId, newPermission.userId);
    equal(itemId, newPermission.itemId);
    equal(group, newPermission.group);
  });
  it.skip("should fetch all permissions", async () => {
    const { body } = await request(app).get("/permissions/").expect(200);

    equal(Array.isArray(body), true);
    equal(body, permissions.permissions);
  });
  it("should fetch a permission by id", async () => {
    const {
      body: { userId, id },
    } = await request(app)
      .get(`/permissions/${permissions.permissions[0].id}`)
      .expect(200);

    equal(id, permissions.permissions[0].id);
    equal(userId, 1);
  });
  it("should update a permission", async () => {
    const {
      body: { group },
    } = await request(app)
      .put(`/permissions/${permissions.permissions[0].id}`)
      .send(permissions.permissions[0])
      .expect(200);

    equal(group, "admin");
  });
  it("should delete a permission", async () => {
    const res = await request(app)
      .delete(`/permissions/${permissions.permissions[0].id}`)
      .expect(204);

    equal(res.status, 204);
  });
  it("should fetch all permissions by user id", async () => {
    const { body } = await request(app)
      .get(`/permissions/user/${permissions.permissions[0].userId}`)
      .expect(200);

    equal(body, permissions.permissions[0]);
  });
  it("should delete permissions by itemId", async () => {
    const { body } = await request(app)
      .delete(`/permissions/item/${permissions.permissions[0].itemId}`)
      .expect(204);

    equal(body, permissions.permissions[0]);
  });
  it("should return 404 with a message if permission not found", async () => {
    const { text } = await request(app).get(`/permissions/999`).expect(404);
    equal(text, "Permission not found");
  });
});

