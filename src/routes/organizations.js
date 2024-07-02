const router = require("express").Router();
const Organization = require("../models/Organization");

router.get("/", async (req, res) => {
  Organization.findAll().then((organizations) => {
    res.status(200).json(organizations);
  });
});

router.get("/:organizationId", async (req, res) => {
  const { organizationId } = req.session;
  Organization.findByPk(organizationId).then((organization) => {
    res.status(200).json(organization);
  });
});

module.exports = router;
