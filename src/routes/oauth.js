const Joi = require("joi");
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("../config");
const { AuthenticationError } = require("../error");
const Permission = require("../models/Permission");
const { project } = config();

router.post("/", async (req, res) => {
  let { appId, projectId, code, refreshToken, redirectUri, provider } = Joi.attempt(
    req.body,
    Joi.object({
      appId: Joi.string().required(),
      projectId: Joi.string().optional(),
      code: Joi.string().optional(),
      refreshToken: Joi.string().optional(),
      redirectUri: Joi.string().optional(),
      provider: Joi.string().valid('github', 'linkedin', 'google').required(),
    })
      .required()
      .options({ stripUnknown: true })
  );

  if (!code && !refreshToken) {
    return res.status(400).json({
      error: "Missing OAuth Code and Refresh Token",
      message: "Either authorization code or refresh token is required"
    });
  }

  const providerConfig = project.oauth.providers[provider];
  if (!providerConfig) {
    return res.status(400).json({
      error: `Unsupported OAuth provider: ${provider}`,
      message: `Provider ${provider} is not configured`
    });
  }

  let accessTokenForAPI;
  let newRefreshToken = refreshToken;

  if (code && redirectUri) {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", providerConfig.clientId);
    params.append("client_secret", process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]);
    params.append("code", code);
    params.append("redirect_uri", redirectUri);

    const tokenResponse = await axios.post(
      providerConfig.tokenUrl,
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: 10000
      }
    );

    if (tokenResponse.data.error) {
      throw new AuthenticationError(
        tokenResponse.data.error_description || tokenResponse.data.error
      );
    }

    if (!tokenResponse.data.access_token) {
      throw new AuthenticationError("No access token received from OAuth provider");
    }

    accessTokenForAPI = tokenResponse.data.access_token;
    newRefreshToken = tokenResponse.data.refresh_token || tokenResponse.data.access_token;
  } else {
    accessTokenForAPI = refreshToken;
  }

  let userResponse;

  userResponse = await axios.get(providerConfig.userUrl, {
    headers: {
      Authorization: `Bearer ${accessTokenForAPI}`,
      "Accept": "application/json"
    },
    timeout: 10000
  });

  console.log("User info response:", userResponse.data);

  let userId;
  const identifierField = providerConfig.userIdentifier;

  if (userResponse.data[identifierField]) {
    userId = userResponse.data[identifierField].toString();
  } else if (userResponse.data[project.oauth.jwt.identifier]) {
    userId = userResponse.data[project.oauth.jwt.identifier].toString();
  } else {
    console.error("User identifier extraction failed:", {
      availableFields: Object.keys(userResponse.data),
      expectedField: identifierField,
      fallbackField: project.oauth.jwt.identifier
    });
    throw new Error(`Cannot find user identifier in ${provider} OAuth response`);
  }

  const prefixedUserId = `${provider}_${userId}`;

  let userDetails;
  if (provider === "github") {
    userDetails = {
      id: prefixedUserId,
      name: userResponse.data.login,
      displayName: userResponse.data.name,
      avatarUrl: userResponse.data.avatar_url,
      email: userResponse.data.email,
      provider: provider
    };
  } else if (provider === "google") {
    userDetails = {
      id: prefixedUserId,
      name: userResponse.data.name,
      displayName: userResponse.data.name,
      avatarUrl: userResponse.data.picture,
      email: userResponse.data.email,
      provider: provider
    };
  } else if (provider === "linkedin") {
    userDetails = {
      id: prefixedUserId,
      name: userResponse.data.name,
      displayName: userResponse.data.name,
      avatarUrl: userResponse.data.picture,
      email: userResponse.data.email,
      provider: provider
    };
  }

  let accessToken;

  if (projectId) {
    const permissions = await Permission.findAll({
      where: { userId: prefixedUserId, projectId, appId },
    });

    if (!permissions.length) {
      accessToken = jwt.sign(
        {
          sub: prefixedUserId,
          iss: "nuc",
          aid: appId,
          provider: provider,
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );
    } else {
      accessToken = jwt.sign(
        {
          sub: prefixedUserId,
          iss: "nuc",
          aud: projectId,
          oid: permissions[0].organizationId,
          aid: appId,
          rls: permissions.map((permission) => permission.role),
          provider: provider,
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );
    }
  } else {
    accessToken = jwt.sign(
      {
        sub: prefixedUserId,
        iss: "nuc",
        aid: appId,
        provider: provider,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );
  }

  res.status(200).json({
    accessToken,
    refreshToken: newRefreshToken,
    user: userDetails 
  });
});

module.exports = router;