import Joi from "joi";
import express, { Request, Response } from "express";
import * as pseudocode from "../functions/pseudocode";
import * as schemas from "../schemas";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const { projectId: teamId } = req.session;

  const { instructions, agentId } = Joi.attempt(
    req.body,
    schemas.Pseudocode.generate,
  );

  const result = await pseudocode.generate({
    instructions,
    meta: { teamId, agentId },
  });

  res.status(200).json({ pseudocode: result });
});

export default router;
