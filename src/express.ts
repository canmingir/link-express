import "express-async-errors";

import * as authorization from "./authorization";

import express, { NextFunction, Request, Response } from "express";

import cors from "cors";
import { getConfig } from "./config";
import health from "./routes/health";
import helmet from "helmet";
import metrics from "./routes/metrics";
import morgan from "morgan";
import notebookBlocks from "./routes/notebookBlocks";
import notebooks from "./routes/notebooks";
import oauth from "./routes/oauth";
import organizations from "./routes/organizations";
import permissions from "./routes/permissions";
import projects from "./routes/projects";
import settings from "./routes/settings";

const app = express();
const publicRouter = express.Router();

const appConfig = getConfig();

app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));

app.use(
  express.json(),
  (err: Error, _req: Request, res: Response, next: NextFunction) =>
    err ? res.status(422).end() : next(),
);

app.use("/health", health);
app.use("/metrics", metrics);

if (appConfig.project) {
  app.use(
    "/oauth",
    express.urlencoded(),
    (err: Error, _req: Request, res: Response, next: NextFunction) =>
      err ? res.status(422).end() : next(),
    oauth,
  );

  app.use(publicRouter);
  app.use(authorization.verify);
}

let routesMounted = false;
function mountRoutes(): void {
  if (routesMounted || !appConfig.project) return;
  routesMounted = true;

  app.use("/projects", projects);
  app.use("/organizations", organizations);
  app.use("/permissions", permissions);
  app.use("/projects/:projectId/settings", settings);
  app.use("/notebooks", notebooks);
  app.use("/notebook-blocks", notebookBlocks);
}

export default app;
export { mountRoutes, publicRouter };
