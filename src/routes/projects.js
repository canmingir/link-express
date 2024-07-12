const Joi = require("joi");
const router = require("express").Router();
const Project = require("../models/Project");
const Organization = require("../models/Organization");
const schemas = require("../schemas");
const config = require("../config");

router.post("/", async (req, res) => {
  const project = Joi.attempt(req.body, schemas.Project);

  const organization = await Organization.create({
    name: `${project.name}-organization`,
  });

  if (config.link && config.link.project) {
    Joi.attempt(project.type, config.link.project.type);
  }

  project.organizationId = organization.id;

  const projectInstance = await Project.create(project);

  res.status(201).json(projectInstance);
});

router.get("/", async (req, res) => {
  const projects = await Project.findAll();

  res.status(200).json(projects);
});

router.get("/:id", async (req, res) => {
  const project = await Project.findByPk(req.params.id);

  if (project) {
    res.status(200).json(project);
  } else {
    res.status(404).end("Project not found");
  }
});

router.patch("/:id", async (req, res) => {
  const project = await Project.findByPk(req.params.id);

  if (project) {
    const updatedProject = Joi.attempt(req.body, schemas.Project);

    await project.update(updatedProject);
    res.status(200).json(project);
  } else {
    res.status(404).end("Project not found");
  }
});

router.delete("/:id", async (req, res) => {
  const project = await Project.findByPk(req.params.id);

  if (project) {
    await project.destroy();
    res.status(204).end();
  } else {
    res.status(404).end("Project not found");
  }
});

module.exports = router;
