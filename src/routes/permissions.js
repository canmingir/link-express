const router = require("express").Router();
const Permission = require("../models/Permission");

router.post("/", async (req, res) => {
  const { userId } = req.body;
  const { projectId, organizationId, appId, roles } = req.session;
  const permissionInstance = await Permission.create({
    userId,
    projectId,
    organizationId,
    appId,
    role: roles[0],
  });
  res.status(201).json(permissionInstance);
});

router.get("/", async (req, res) => {
  const { projectId } = req.session;

  const permissions = await Permission.findAll({
    where: {
      projectId,
    },
  });

  if (permissions.length === 0) {
    res.status(404).end("Permission not found");
  } else {
    res.status(200).json(permissions);
  }
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
