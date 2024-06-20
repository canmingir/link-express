const jwt = require("jsonwebtoken");
const { AuthorizationError } = require("./error");

function verify(req, res, next) {
  if (process.env.PROFILE === "TEST") {
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
    const { sub, aud, roles, aid, cid } = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    req.session = {
      projectId: aud,
      userId: sub,
      roles,
      appId: aid,
      companyId: cid,
    };
  } catch (error) {
    throw new AuthorizationError();
  }

  next();
}

module.exports = { verify };
