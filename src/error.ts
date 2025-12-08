import { ValidationError } from "joi";
import { Request, Response, NextFunction } from "express";

interface AxiosError extends Error {
  isAxiosError: boolean;
  response?: {
    status: number;
  };
}

interface ErrorWithError {
  error: unknown;
}

const handle = (
  err:
    | string
    | ValidationError
    | AuthorizationError
    | AuthenticationError
    | NotFoundError
    | AxiosError
    | ErrorWithError
    | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
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
    return res.status(403).end();
  }

  if (err instanceof NotFoundError) {
    return res.status(404).end();
  }

  if ("isAxiosError" in err && err.isAxiosError) {
    return res.status(err.response?.status || 503).end();
  }

  if ("error" in err && err.error) {
    return res.status(400).json(err);
  } else {
    console.error(err);
    return res.status(500).end();
  }
};

class AuthorizationError extends Error {}
class AuthenticationError extends Error {}
class NotFoundError extends Error {}

export { handle, AuthorizationError, NotFoundError, AuthenticationError };
