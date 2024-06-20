const router = require("express").Router();
const Company = require("../models/Company");

router.get("/", async (req, res) => {
  Company.findAll().then((companies) => {
    res.status(200).json(companies);
  });
});

router.get("/:companyId", async (req, res) => {
  const { companyId } = req.session;
  Company.findByPk(companyId).then((company) => {
    res.status(200).json(company);
  });
});

module.exports = router;
