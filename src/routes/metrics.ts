import express, { Request, Response } from "express";
import os from "os";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    free: os.freemem(),
    total: os.totalmem(),
  });
});

export = router;
