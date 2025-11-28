import express, { Request, Response } from "express";
import * as settings from "../lib/settings";
import { AuthorizationError } from "../error";

const router = express.Router({ mergeParams: true });

interface SettingsRequest extends Request {
  params: {
    projectId: string;
  };
}

router.get("/", async (req: SettingsRequest, res: Response) => {
  if (req.params.projectId !== req.session.projectId) {
    throw new AuthorizationError();
  }

  const setting = await settings.get(req.session);
  res.json(setting);
});

router.patch("/", async (req: SettingsRequest, res: Response) => {
  if (req.params.projectId !== req.session.projectId) {
    throw new AuthorizationError();
  }

  await settings.upsert(req.session, req.body, req.params);
  res.end();
});

export = router;
