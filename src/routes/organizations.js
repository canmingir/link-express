const router = require("express").Router();
const Organization = require("../models/Organization");
const Permission = require("../models/Permission");

router.post("/", async (req, res) => {
  const organization = req.body;

  Organization.create(organization).then((organization) => {
    res.status(201).json(organization);
  });
});

router.get("/", async (req, res) => {
  const { userId } = req.session;

  const organizations = await Organization.findAll({
    include: [
      {
        model: Permission,
        as: "permissions",
        where: { userId },
        attributes: [],
      },
    ],
  });

  res.status(200).json(organizations);
});

router.get("/:id", async (req, res) => {
  const { organizationId } = req.session;
  const { id } = req.params;

  if (organizationId !== id) {
    return res.status(401).end();
  }

  const organization = await Organization.findByPk(organizationId);
  res.status(200).json(organization);
});

module.exports = router;
