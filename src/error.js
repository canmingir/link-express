const { ValidationError } = require("joi");
const { DatabaseError } = require("sequelize");

// eslint-disable-next-line no-unused-vars
const handle = (err, req, res, next) => {
  if (typeof err === "string") {
    return res.status(400).json({ error: err });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof AuthorizationError) {
    return res.status(401).end();
  }

  if (err instanceof AuthenticationError) {
    return res.status(401).end();
  }

  if (err instanceof NotFoundError) {
    return res.status(404).end();
  }

  if (err.isAxiosError) {
    return res.status(err.response?.status || 503).end();
  }

  if (err instanceof DatabaseError) {
    console.error("Sequelize Database Error:", err);
    return res.status(500).json({ message: "Database Error" });
  }

  if (err.error) {
    return res.status(400).json(err);
  } else {
    return res.status(500).send(err.toString());
  }
};

class AuthorizationError extends Error {}
class AuthenticationError extends Error {}
class NotFoundError extends Error {}

module.exports = {
  handle,
  AuthorizationError,
  NotFoundError,
  AuthenticationError,
};
