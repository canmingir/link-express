import express, { Request, Response, NextFunction } from "express";
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import * as authorization from "./authorization";
import settings from "./routes/settings";
import metrics from "./routes/metrics";
import oauth from "./routes/oauth";
import permissions from "./routes/permissions";
import organizations from "./routes/organizations";
import projects from "./routes/projects";
import notebooks from "./routes/notebooks";
import notebookBlocks from "./routes/notebookBlocks";
import { getConfig } from "./config";

const app = express();

const appConfig = getConfig();

app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));

app.use(
  express.json(),
  (err: Error, _req: Request, res: Response, next: NextFunction) =>
    err ? res.status(422).end() : next(),
);

app.use("/metrics", metrics);

if (appConfig.project) {
  app.use(
    "/oauth",
    express.urlencoded(),
    (err: Error, _req: Request, res: Response, next: NextFunction) =>
      err ? res.status(422).end() : next(),
    oauth,
  );

  app.use(authorization.verify);

  setImmediate(() => {
    app.use("/projects", projects);
    app.use("/organizations", organizations);
    app.use("/permissions", permissions);
    app.use("/projects/:projectId/settings", settings);
    app.use("/notebooks", notebooks);
    app.use("/notebook-blocks", notebookBlocks);
  });
}

export default app;
