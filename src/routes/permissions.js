const Joi = require("joi");
const router = require("express").Router();
const Permission = require("../models/Permission");
require("dotenv").config();

router.post("/", async (req, res) => {
  let { userId, itemId, group } = Joi.attempt(
    req.body,
    Joi.object({
      userId: Joi.number().required(),
      itemId: Joi.string().guid().required(),
      group: Joi.string().required(),
    })
      .required()
      .options({ stripUnknown: true })
  );

  if (!userId || !itemId || !group) {
    return res.status(400).send("Missing required fields");
  }

  const permission = await Permission.create({ userId, itemId, group });
  res.status(201).json(permission);
});

router.get("/", async (req, res) => {
  const permissions = await Permission.findAll();
  res.status(200).json(permissions);
});

router.get("/:id", async (req, res) => {
  const permission = await Permission.findByPk(req.params.id);
  if (!permission) {
    return res.status(404).send("Permission not found");
  }
  res.status(200).json(permission);
});

router.put("/:id", async (req, res) => {
  const permission = await Permission.findByPk(req.params.id);
  if (!permission) {
    return res.status(404).send("Permission not found");
  }

  let { userId, itemId, group } = Joi.attempt(
    req.body,
    Joi.object({
      userId: Joi.number().required(),
      itemId: Joi.number().required(),
      group: Joi.string().required(),
    })
      .required()
      .options({ stripUnknown: true })
  );

  if (!userId || !itemId || !group) {
    return res.status(400).send("Missing required fields");
  }

  permission.userId = userId;
  permission.itemId = itemId;
  permission.group = group;
  await permission.save();
  res.status(200).json(permission);
});

router.delete("/:id", async (req, res) => {
  const permission = await Permission.findByPk(req.params.id);
  if (!permission) {
    return res.status(404).send("Permission not found");
  }

  await permission.destroy();
  res.status(204).send();
});

router.get("/user/:userId", async (req, res) => {
  const permissions = await Permission.findAll({
    where: { userId: req.params.userId },
  });
  res.status(200).json(permissions);
});

router.get("/item/:itemId", async (req, res) => {
  const permissions = await Permission.findAll({
    where: { itemId: req.params.itemId },
  });
  res.status(200).json(permissions);
});

module.exports = router;
