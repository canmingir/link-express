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

const config = require("./config")();

app.use(helmet());
app.use(cors());
app.use(morgan("tiny"));

app.use(express.json(), (err, req, res, next) =>
  err ? res.status(422).end() : next()
);
app.use(express.urlencoded(), (err, req, res, next) =>
  err ? res.status(422).end() : next()
);

if (config.oauth) {
  const oauth = require("./routes/oauth");
  app.use("/oauth", oauth);
}

app.use("/openapi", swaggerUi.serve, swaggerUi.setup(openapi));
app.use("/metrics", metrics);

// TODO Add oauth verification

setImmediate(() => {
  app.use((req, res) => res.status(404).end());
  app.use(error.handle);
});

module.exports = app;
