import Joi from "joi";
import express, { Request, Response } from "express";
import NotebookBlock from "../models/NotebookBlock.model";
import * as schemas from "../schemas";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { notebookId } = req.query;

  Joi.attempt(notebookId, Joi.string().guid().required());

  const blocks = await NotebookBlock.findAll({
    where: { notebookId: notebookId as string, teamId },
    order: [["order", "ASC"]],
  });

  res.status(200).json(blocks);
});

router.post("/", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;

  const validated = Joi.attempt(req.body, schemas.NotebookBlock.create);
  validated.teamId = teamId;

  const block = await NotebookBlock.create(validated);

  res.status(201).json(block);
});

router.put("/:id", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { id } = req.params;

  const validatedId = Joi.attempt(id, Joi.string().guid().required());
  const validated = Joi.attempt(req.body, schemas.NotebookBlock.update);

  const block = await NotebookBlock.findByPk(validatedId);

  if (!block || block.teamId !== teamId) {
    res.status(404).end();
    return;
  }

  await block.update(validated);

  res.status(200).json(block);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;
  const { id } = req.params;

  const validatedId = Joi.attempt(id, Joi.string().guid().required());

  const block = await NotebookBlock.findByPk(validatedId);

  if (!block || block.teamId !== teamId) {
    res.status(404).end();
    return;
  }

  await block.destroy();

  res.status(204).end();
});

export default router;
