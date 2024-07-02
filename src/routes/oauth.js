const Joi = require("joi");
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("../config");
const { AuthenticationError } = require("../error");
const Permission = require("../models/Permission");
const { oauth } = config();

router.post("/", async (req, res) => {
  let { appId, projectId, code, refreshToken, redirectUri } = Joi.attempt(
    req.body,
    Joi.object({
      appId: Joi.string().required(),
      projectId: Joi.string().optional(),
      code: Joi.string().optional(),
      refreshToken: Joi.string().optional(),
      redirectUri: Joi.string().optional(),
    })
      .required()
      .options({ stripUnknown: true })
  );
  if (!code && !refreshToken) {
    return res.status(400).send("Missing OAuth Code and Refresh Token");
  }
  if (code && redirectUri) {
    const params = new URLSearchParams();
    params.append("client_id", oauth.clientId);
    params.append("client_secret", process.env.OAUTH_CLIENT_SECRET);
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("grant_type", "authorization_code");
    const { data } = await axios.post(oauth.tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const urlParams = new URLSearchParams(data);

    if (urlParams.get("error")) {
      throw new AuthenticationError(urlParams.get("error_description"));
    }

    refreshToken = urlParams.get("access_token");
  }

  const { data } = await axios.get(oauth.userUrl, {
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });

  const userId = data[oauth.jwt.identifier];

  let accessToken;

  if (projectId) {
    const permissions = await Permission.findAll({
      where: { userId, projectId, appId },
    });
    if (!permissions.length) {
      accessToken = jwt.sign(
        { sub: userId, iss: "nuc" },
        process.env.JWT_SECRET,
        {
          expiresIn: "12h",
        }
      );
    } else {
      accessToken = jwt.sign(
        {
          sub: userId,
          iss: "nuc",
          aud: projectId,
          cid: permissions[0].organizationId,
          aid: appId,
          rls: permissions.map((permission) => permission.role),
        },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );
    }
  } else {
    accessToken = jwt.sign(
      { sub: userId, iss: "nuc" },
      process.env.JWT_SECRET,
      {
        expiresIn: "12h",
      }
    );
  }

  res.status(200).json({ accessToken, refreshToken });
});

module.exports = router;
