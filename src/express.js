const express = require("express");
require("express-async-errors");

const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const app = express();

const metrics = require("./routes/metrics");

const swaggerUi = require("swagger-ui-express");
const openapi = require("./openapi");
const error = require("./error");
const authorization = require("./authorization");
const settings = require("./routes/settings");

const config = require("./config")();

app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));

app.use(express.json(), (err, req, res, next) =>
  err ? res.status(422).end() : next()
);

if (config.project) {
  const oauth = require("./routes/oauth");
  app.use(
    "/oauth",
    express.urlencoded(),
    (err, req, res, next) => (err ? res.status(422).end() : next()),
    oauth
  );
}

app.use("/openapi", swaggerUi.serve, swaggerUi.setup(openapi));
app.use("/metrics", metrics);

setImmediate(() => {
  process.env.PROFILE === "TEST" && app.use(authorization.verify);

  if (config.project) {
    const permissions = require("./routes/permissions");
    const organizations = require("./routes/organizations");
    const projects = require("./routes/projects");

    app.use("/projects", projects);
    app.use("/organizations", organizations);
    app.use("/permissions", permissions);
    app.use("/projects/:projectId/settings", settings);
  }

  app.use((req, res) => res.status(404).end());
  app.use(error.handle);
});

module.exports = app;
