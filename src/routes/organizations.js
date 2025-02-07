const router = require("express").Router();
const Organization = require("../models/Organization");

router.post("/", async (req, res) => {
  const organization = req.body;

  Organization.create(organization).then((organization) => {
    res.status(201).json(organization);
  });
});

router.get("/", async (req, res) => {
  Organization.findAll().then((organizations) => {
    res.status(200).json(organizations);
  });
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
