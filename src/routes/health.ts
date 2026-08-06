import express, { Request, Response } from "express";
import { getModules } from "../platform";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  const { Postgres } = getModules();

  if (Postgres?.sequelize) {
    try {
      await Postgres.sequelize.authenticate();
      checks.postgres = "up";
    } catch (error) {
      checks.postgres = "down";
      healthy = false;
    }
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "error",
    uptime: process.uptime(),
    checks,
  });
});

export default router;
