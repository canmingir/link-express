const jwt = require("jsonwebtoken");
const { AuthorizationError } = require("./error");

function verify(req, res, next) {
  if (process.env.PROFILE === "TEST") {
    switch (process.env.PROJECT_ID) {
      case "0c756054-2d28-4f87-9b12-8023a79136a5":
        req.session = {
          projectId: "0c756054-2d28-4f87-9b12-8023a79136a5",
          userId: "marcus@nucleoidai.com",
          roles: ["ADMIN"],
          appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
          organizationId: "1c063446-7e78-432a-a273-34f481d0f0c3",
        };
        break;
      case "21d2530b-4657-4ac0-b8cd-1a9f82786e32":
        req.session = {
          projectId: "21d2530b-4657-4ac0-b8cd-1a9f82786e32",
          userId: "marcus@nucleoidai.com",
          roles: ["ADMIN"],
          appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
          organizationId: "5459ab03-204a-4627-bdde-667b7802cb35",
        };
        break;
      default:
        req.session = {
          projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
          userId: "marcus@nucleoidai.com",
          roles: ["ADMIN"],
          appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
          organizationId: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
        };
        break;
    }
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
    const { sub, aud, rls, aid, oid } = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    req.session = {
      projectId: aud,
      userId: sub,
      roles: rls,
      appId: aid,
      organizationId: oid,
    };
  } catch (error) {
    throw new AuthorizationError();
  }

  next();
}

module.exports = { verify };

