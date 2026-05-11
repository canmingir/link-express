import { Op } from "sequelize";
import Joi from "joi";
import express, { Request, Response } from "express";
import Notebook from "../models/Notebook.model";
import NotebookBlock from "../models/NotebookBlock.model";
import * as schemas from "../schemas";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;

  const notebooks = await Notebook.findAll({ where: { teamId } });

  res.status(200).json(notebooks);
});

router.post("/", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;

  const validated = Joi.attempt(req.body, schemas.Notebook.create);
  validated.teamId = teamId;

  const exists = await Notebook.findOne({
    where: { teamId, path: validated.path, title: validated.title },
  });

  if (exists) {
    res.status(409).end();
    return;
  }

  const notebook = await Notebook.create(validated);

  res.status(201).json(notebook);
});

router.post("/move-path", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { oldPath, newPath } = Joi.attempt(req.body, schemas.Notebook.movePath);

  const notebooks = await Notebook.findAll({
    where: {
      teamId,
      [Op.or]: [{ path: oldPath }, { path: { [Op.like]: `${oldPath}/%` } }],
    },
  });

  await Promise.all(
    notebooks.map((nb) =>
      nb.update({ path: nb.path.replace(oldPath, newPath) }),
    ),
  );

  res.status(200).json({ updated: notebooks.length });
});

router.delete("/by-path", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { path } = req.query;

  const validatedPath = Joi.attempt(path, Joi.string().min(1).required());

  const notebooks = await Notebook.findAll({
    where: {
      teamId,
      [Op.or]: [
        { path: validatedPath },
        { path: { [Op.like]: `${validatedPath}/%` } },
      ],
    },
    attributes: ["id"],
  });

  const ids = notebooks.map((nb) => nb.id);

  if (ids.length > 0) {
    await NotebookBlock.destroy({ where: { notebookId: ids } });
    await Notebook.destroy({ where: { id: ids, teamId } });
  }

  res.status(204).end();
});

router.put("/:id", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { id } = req.params;

  const validatedId = Joi.attempt(id, Joi.string().guid().required());
  const validated = Joi.attempt(req.body, schemas.Notebook.update);

  const notebook = await Notebook.findByPk(validatedId);

  if (!notebook || notebook.teamId !== teamId) {
    res.status(404).end();
    return;
  }

  const newTitle = validated.title ?? notebook.title;
  const newPath = validated.path ?? notebook.path;

  const exists = await Notebook.findOne({
    where: {
      teamId,
      path: newPath,
      title: newTitle,
      id: { [Op.ne]: validatedId },
    },
  });

  if (exists) {
    res.status(409).end();
    return;
  }

  await notebook.update(validated);

  res.status(200).json(notebook);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { id } = req.params;

  const validatedId = Joi.attempt(id, Joi.string().guid().required());

  const notebook = await Notebook.findByPk(validatedId);

  if (!notebook || notebook.teamId !== teamId) {
    res.status(404).end();
    return;
  }

  await NotebookBlock.destroy({ where: { notebookId: validatedId, teamId } });
  await notebook.destroy();

  res.status(204).end();
});

export default router;
