const jwt = require("jsonwebtoken");
const { AuthorizationError } = require("./error");
const { config } = require("../config");

function verify(req, res, next) {
  if (config.profile === "TEST") {
    req.userId = 100001;
    return next();
  }

  const authorization = req.headers["authorization"];

  if (!authorization) {
    throw new AuthorizationError();
  }

  const parts = authorization.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new AuthorizationError();
  }

  const token = parts[1];

  try {
    const { sub } = jwt.verify(token, config.jwt_secret);
    req.userId = sub;
  } catch (error) {
    throw new AuthorizationError();
  }

  next();
}

module.exports = { verify };
