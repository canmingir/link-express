const router = require("express").Router();
const Company = require("../models/Company");
const Joi = require("joi");
const schemas = require("../schemas");

router.post("/", async (req, res) => {
  const company = Joi.attempt(req.body, schemas.Company.create);

  const companyInstance = await Company.create(company);
  res.status(201).json(companyInstance);
});

router.get("/", async (req, res) => {
  const companies = await Company.findAll();
  res.status(200).json(companies);
});

router.get("/:id", async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (company) {
    res.status(200).json(company);
  } else {
    res.status(404).json({ message: "Company not found" });
  }
});

router.put("/:id", async (req, res) => {
  const [updated] = await Company.update(req.body, {
    where: { id: req.params.id },
  });
  if (updated) {
    const updatedCompany = await Company.findByPk(req.params.id);
    res.status(200).json(updatedCompany);
  } else {
    res.status(404).json({ message: "Company not found" });
  }
});

router.delete("/:id", async (req, res) => {
  const deleted = await Company.destroy({
    where: { id: req.params.id },
  });
  if (deleted) {
    res.status(204).json({ message: "Company deleted" });
  } else {
    res.status(404).json({ message: "Company not found" });
  }
});

module.exports = router;
