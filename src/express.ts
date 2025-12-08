import express, { Request, Response, NextFunction } from "express";
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import * as error from "./error";
import * as authorization from "./authorization";
import settings from "./routes/settings";
import metrics from "./routes/metrics";
import { getConfig } from "./config";

const app = express();

const appConfig = getConfig();

app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));

app.use(
  express.json(),
  (err: Error, _req: Request, res: Response, next: NextFunction) =>
    err ? res.status(422).end() : next()
);

if (appConfig.project) {
  import("./routes/oauth.ts").then((oauthModule) => {
    const oauth = oauthModule.default || oauthModule;
    app.use(
      "/oauth",
      express.urlencoded(),
      (err: Error, _req: Request, res: Response, next: NextFunction) =>
        err ? res.status(422).end() : next(),
      oauth
    );
  });
}

app.use("/metrics", metrics);

setImmediate(async () => {
  process.env.PROFILE === "TEST" && app.use(authorization.verify);

  if (appConfig.project) {
    const [permissionsModule, organizationsModule, projectsModule] =
      await Promise.all([
        import("./routes/permissions.ts"),
        import("./routes/organizations.ts"),
        import("./routes/projects.ts"),
      ]);

    const permissions = permissionsModule.default || permissionsModule;
    const organizations = organizationsModule.default || organizationsModule;
    const projects = projectsModule.default || projectsModule;

    app.use("/projects", projects);
    app.use("/organizations", organizations);
    app.use("/permissions", permissions);
    app.use("/projects/:projectId/settings", settings);
  }

  app.use((_req: Request, res: Response) => res.status(404).end());
  app.use(error.handle);
});

export default app;
