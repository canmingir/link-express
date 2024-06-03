const Joi = require("joi");
const router = require("express").Router();
const Permission = require("../models/Permission");
const schemas = require("../schemas");

router.post("/", async (req, res) => {
  const permission = Joi.attempt(req.body, schemas.Permission.create);

  const permissionInstance = await Permission.create(permission);
  res.status(201).json(permissionInstance);
});

router.get("/", async (req, res) => {
  const permission = Joi.attempt(req.query, schemas.Permission.list);

  const permissions = await Permission.findAll({
    where: permission,
  });
  res.status(200).json(permissions);
});

router.delete("/:id", async (req, res) => {
  const instance = await Permission.findByPk(req.params.id);

  if (instance) {
    await instance.destroy();
    res.status(204).end();
  } else {
    res.status(404).end("Permission not found");
  }
});

module.exports = router;
