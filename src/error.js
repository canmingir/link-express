const { ValidationError } = require("joi");

// eslint-disable-next-line no-unused-vars
const handle = (err, req, res, next) => {
  if (err instanceof String) {
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

  if (err.error) res.status(400).json(err);
  else res.status(500).send(err);
};

class AuthorizationError {}
class AuthenticationError {}
class NotFoundError {}

module.exports = {
  handle,
  AuthorizationError,
  NotFoundError,
  AuthenticationError,
};
