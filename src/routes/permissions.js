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
    res.status(404);
  } else {
    res.status(200).json(permissions);
  }
});

router.delete("/:userId", async (req, res) => {
  const { projectId } = req.session;
  const userId = req.params.userId;

  const instance = await Permission.findOne({
    where: { userId: userId, projectId },
  });

  if (instance) {
    await instance.destroy();
    res.status(204).end();
  } else {
    res.status(404);
  }
});

module.exports = router;
