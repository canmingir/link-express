import express, { Request, Response } from "express";
import Permission from "../models/Permission.model";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  const { userId } = req.body;
  const { projectId, organizationId, appId, roles } = req.session;
  const permissionInstance = await Permission.create({
    userId,
    projectId,
    organizationId,
    appId,
    role: roles[0],
  });
  res.status(201).json(permissionInstance);
});

router.get("/", async (req: Request, res: Response) => {
  const { projectId, organizationId } = req.session;

  const permissions = await Permission.findAll({
    where: {
      projectId,
      organizationId,
    },
  });

  if (permissions.length === 0) {
    res.status(404).end();
  } else {
    res.status(200).json(permissions);
  }
});

router.delete("/:userId", async (req: Request, res: Response) => {
  const { projectId, organizationId } = req.session;
  const userId = req.params.userId;

  const instance = await Permission.findOne({
    where: { userId: userId, projectId, organizationId },
  });

  if (instance) {
    await instance.destroy();
    res.status(204).end();
  } else {
    res.status(404).end();
  }
});

export default router;
