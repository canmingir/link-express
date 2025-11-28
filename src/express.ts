import express, { Request, Response, NextFunction } from "express";
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import * as error from "./error";
import * as authorization from "./authorization";
import settings from "./routes/settings";
import metrics from "./routes/metrics";
import config from "./config";

const app = express();

const appConfig = config();

app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));

app.use(
  express.json(),
  (err: Error, _req: Request, res: Response, next: NextFunction) =>
    err ? res.status(422).end() : next()
);

if (appConfig.project) {
  const oauth = require("./routes/oauth");
  app.use(
    "/oauth",
    express.urlencoded(),
    (err: Error, _req: Request, res: Response, next: NextFunction) =>
      err ? res.status(422).end() : next(),
    oauth
  );
}

app.use("/metrics", metrics);

setImmediate(() => {
  process.env.PROFILE === "TEST" && app.use(authorization.verify);

  if (appConfig.project) {
    const permissions = require("./routes/permissions");
    const organizations = require("./routes/organizations");
    const projects = require("./routes/projects");

    app.use("/projects", projects);
    app.use("/organizations", organizations);
    app.use("/permissions", permissions);
    app.use("/projects/:projectId/settings", settings);
  }

  app.use((_req: Request, res: Response) => res.status(404).end());
  app.use(error.handle);
});

export = app;
