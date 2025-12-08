import Joi from "joi";
import express, { Request, Response } from "express";
import Project from "../models/Project.model";
import Organization from "../models/Organization.model";
import Permission from "../models/Permission.model";
import * as schemas from "../schemas";
import config from "../config";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const project = Joi.attempt(req.body, schemas.Project);

  const appConfig = config();
  if (appConfig.link && appConfig.link.project) {
    Joi.attempt(
      project.type,
      (appConfig.link.project as { type: Joi.Schema }).type
    );
  }

  const projectInstance = await Project.create(project);

  await Permission.create({
    userId: req.session.userId,
    organizationId: project.organizationId,
    role: "OWNER",
    projectId: projectInstance.id,
    appId: req.session.appId,
  });

  res.status(201).json(projectInstance);
});

router.get("/", async (req: Request, res: Response) => {
  const { userId, appId } = req.session;

  const projects = await Project.findAll({
    include: [
      {
        model: Permission,
        where: { userId, appId },
        attributes: [],
        as: "permissions",
      },
      {
        model: Organization,
        as: "organization",
      },
    ],
    attributes: {
      exclude: ["organizationId"],
    },
  });

  res.status(200).json(projects);
});

router.get("/:id", async (req: Request, res: Response) => {
  const { userId, organizationId } = req.session;
  const { id } = req.params;

  const project = await Project.findOne({
    include: [
      {
        model: Permission,
        where: { userId, organizationId },
        attributes: [],
        as: "permissions",
      },
    ],
    where: { id },
  });

  if (project) {
    res.status(200).json(project);
  } else {
    res.status(404).end();
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { userId, organizationId } = req.session;
  const { id } = req.params;

  const project = await Project.findOne({
    include: [
      {
        model: Permission,
        where: { userId, organizationId },
        attributes: [],
        as: "permissions",
      },
    ],
    where: { id },
  });

  if (project) {
    await project.destroy();
    res.status(204).end();
  } else {
    res.status(404).end();
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const { userId, organizationId } = req.session;
  const { id } = req.params;

  const project = await Project.findOne({
    include: [
      {
        model: Permission,
        where: { userId, organizationId },
        attributes: [],
        as: "permissions",
      },
    ],
    where: { id },
  });

  if (project) {
    const updatedProject = Joi.attempt(req.body, schemas.Project);
    await project.update(updatedProject);
    res.status(200).json(project);
  } else {
    res.status(404).end();
  }
});

export default router;
