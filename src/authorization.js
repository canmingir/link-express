const jwt = require("jsonwebtoken");
const { AuthorizationError } = require("./error");

function verify(req, res, next) {
  if (process.env.PROFILE === "TEST") {
    req.session = {
      projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
      userId: 100001,
      roles: ["ADMIN"],
      appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
      companyId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
    };
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
