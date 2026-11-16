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
import pseudocode from "./routes/pseudocode";
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

const internalRoutes = (): { path: string; router: express.Router }[] =>
  appConfig.project
    ? [
        { path: "/projects", router: projects },
        { path: "/organizations", router: organizations },
        { path: "/permissions", router: permissions },
        { path: "/projects/:projectId/settings", router: settings },
        { path: "/notebooks", router: notebooks },
        { path: "/notebook-blocks", router: notebookBlocks },
        { path: "/pseudocode", router: pseudocode },
      ]
    : [];

let routesMounted = false;
function mountRoutes(): void {
  if (routesMounted || !appConfig.project) return;
  routesMounted = true;

  for (const { path, router } of internalRoutes()) {
    app.use(path, router);
  }
}

export default app;
export { internalRoutes, mountRoutes, publicRouter };
