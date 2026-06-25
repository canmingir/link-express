import { AuthenticationError, AuthorizationError } from "../error";
import express, { Request, Response } from "express";

import Joi from "joi";
import Permission from "../models/Permission.model";
import axios from "axios";
import config from "../config";
import jwt from "jsonwebtoken";
import { verifyCognitoAccessToken } from "../lib/cognitoVerifier";

const router = express.Router();

const { project } = config();

if (!project) {
  throw new Error("Project configuration is required");
}

const providers = project?.oauth?.providers || {};

const identityProviders: Record<string, (typeof providers)[string]> = {};

for (const [key, value] of Object.entries(providers)) {
  const identityProviderKey = key.toLowerCase();

  if (identityProviders[identityProviderKey]) {
    throw new Error(
      `Duplicate OAuth provider configuration detected for key "${key}". Provider keys must be unique in a case-insensitive manner.`,
    );
  }

  identityProviders[identityProviderKey] = value;
}

function getProviderConfig(identityProvider: string) {
  return identityProviders[identityProvider.toLowerCase()];
}

router.post(
  "/",
  async (req: Request, res: Response): Promise<Response | void> => {
    const {
      appId,
      projectId,
      code,
      refreshToken,
      redirectUri,
      identityProvider,
      username,
      password,
    } = Joi.attempt(
      req.body,
      Joi.object({
        appId: Joi.string().required(),
        projectId: Joi.string().optional(),
        code: Joi.string().optional(),
        refreshToken: Joi.string().optional(),
        redirectUri: Joi.string().optional(),
        identityProvider: Joi.string().required(),
        username: Joi.string().optional().allow("admin"),
        password: Joi.string().optional().allow("admin"),
      })
        .required()
        .options({ stripUnknown: true }),
    ) as {
      appId: string;
      projectId?: string;
      code?: string;
      refreshToken?: string;
      redirectUri?: string;
      identityProvider: string;
      username?: string;
      password?: string;
    };

    if (username && password && identityProvider.toUpperCase() === "DEMO") {
      if (username !== "admin" || password !== "admin") {
        throw new AuthenticationError("Invalid demo credentials");
      }

      const userId = "1001";

      let accessToken: string;

      if (projectId) {
        const permissions = await Permission.findAll({
          where: { userId, projectId, appId },
        });

        if (!permissions.length) {
          accessToken = jwt.sign(
            {
              sub: userId,
              iss: "nuc",
              aid: appId,
              aud: projectId,
              oid: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
              rls: ["OWNER"],
              identityProvider: "DEMO",
              iat: Math.floor(Date.now() / 1000),
            },
            process.env.JWT_SECRET as string,
            { expiresIn: "12h" },
          );
        } else {
          accessToken = jwt.sign(
            {
              sub: userId,
              iss: "nuc",
              aud: projectId,
              oid: permissions[0].organizationId,
              aid: appId,
              rls: permissions.map((p) => p.role),
              identityProvider: "DEMO",
              iat: Math.floor(Date.now() / 1000),
            },
            process.env.JWT_SECRET as string,
            { expiresIn: "12h" },
          );
        }
      } else {
        accessToken = jwt.sign(
          {
            sub: userId,
            iss: "nuc",
            aid: appId,
            identityProvider: "DEMO",
            iat: Math.floor(Date.now() / 1000),
          },
          process.env.JWT_SECRET as string,
          { expiresIn: "12h" },
        );
      }

      const refreshToken = jwt.sign(
        {
          sub: userId,
          type: "refresh",
          identityProvider: "DEMO",
          iat: Math.floor(Date.now() / 1000),
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "30d" },
      );

      return res.status(200).json({
        accessToken,
        refreshToken,
      });
    }

    if (identityProvider.toUpperCase() === "COGNITO") {
      if (!refreshToken) {
        throw new AuthenticationError("Missing token");
      }

      const maybeInternal = jwt.decode(refreshToken) as any;

      const isInternalRefresh =
        maybeInternal?.type === "refresh" &&
        (maybeInternal?.identityProvider || "").toUpperCase() === "COGNITO";

      if (isInternalRefresh) {
        const verified = jwt.verify(
          refreshToken,
          process.env.JWT_SECRET as string,
        ) as { sub: string; type: string; identityProvider: string };

        const userId = verified.sub;

        let accessToken: string;

        if (projectId) {
          const permissions = await Permission.findAll({
            where: { userId, projectId, appId },
          });

          if (!permissions.length) {
            accessToken = jwt.sign(
              {
                sub: userId,
                iss: "nuc",
                aid: appId,
                aud: projectId,
                oid: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
                rls: ["OWNER"],
                identityProvider: "COGNITO",
                iat: Math.floor(Date.now() / 1000),
              },
              process.env.JWT_SECRET as string,
              { expiresIn: "12h" },
            );
          } else {
            accessToken = jwt.sign(
              {
                sub: userId,
                iss: "nuc",
                aud: projectId,
                oid: permissions[0].organizationId,
                aid: appId,
                rls: permissions.map((p) => p.role),
                identityProvider: "COGNITO",
                iat: Math.floor(Date.now() / 1000),
              },
              process.env.JWT_SECRET as string,
              { expiresIn: "12h" },
            );
          }
        } else {
          accessToken = jwt.sign(
            {
              sub: userId,
              iss: "nuc",
              aid: appId,
              identityProvider: "COGNITO",
              iat: Math.floor(Date.now() / 1000),
            },
            process.env.JWT_SECRET as string,
            { expiresIn: "12h" },
          );
        }

        return res.status(200).json({
          accessToken,
          refreshToken,
        });
      }

      if (refreshToken.split(".").length !== 3) {
        throw new AuthenticationError(
          "Expected Cognito access token (JWT) but received a non-JWT token",
        );
      }

      const decodedCognito = await verifyCognitoAccessToken(refreshToken);
      const userId = decodedCognito.sub;

      let accessToken: string;

      if (projectId) {
        const permissions = await Permission.findAll({
          where: { userId, projectId, appId },
        });

        if (!permissions.length) {
          accessToken = jwt.sign(
            {
              sub: userId,
              iss: "nuc",
              aid: appId,
              aud: projectId,
              oid: "dfb990bb-81dd-4584-82ce-050eb8f6a12f",
              rls: ["OWNER"],
              identityProvider: "COGNITO",
              iat: Math.floor(Date.now() / 1000),
            },
            process.env.JWT_SECRET as string,
            { expiresIn: "12h" },
          );
        } else {
          accessToken = jwt.sign(
            {
              sub: userId,
              iss: "nuc",
              aud: projectId,
              oid: permissions[0].organizationId,
              aid: appId,
              rls: permissions.map((p) => p.role),
              identityProvider: "COGNITO",
              iat: Math.floor(Date.now() / 1000),
            },
            process.env.JWT_SECRET as string,
            { expiresIn: "12h" },
          );
        }
      } else {
        accessToken = jwt.sign(
          {
            sub: userId,
            iss: "nuc",
            aid: appId,
            identityProvider: "COGNITO",
            iat: Math.floor(Date.now() / 1000),
          },
          process.env.JWT_SECRET as string,
          { expiresIn: "12h" },
        );
      }

      const internalRefreshToken = jwt.sign(
        {
          sub: userId,
          type: "refresh",
          identityProvider: "COGNITO",
          iat: Math.floor(Date.now() / 1000),
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "30d" },
      );

      return res.status(200).json({
        accessToken,
        refreshToken: internalRefreshToken,
      });
    }

    if (!code && !refreshToken) {
      return res.status(400).send("Missing OAuth Code and Refresh Token");
    }

    const providerConfig = getProviderConfig(identityProvider) as {
      clientId: string;
      tokenUrl: string;
      userUrl: string;
      userIdentifier: string;
      userFields: {
        name: string;
        displayName: string;
        avatarUrl: string;
        email: string;
      };
    };
    if (!providerConfig) {
      return res.status(400).send("Unsupported OAuth provider");
    }

    let accessTokenForAPI: string;
    let newRefreshToken = refreshToken;

    if (code && redirectUri) {
      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("client_id", providerConfig.clientId);
      params.append(
        "client_secret",
        process.env[
          `${identityProvider.toUpperCase()}_CLIENT_SECRET`
        ] as string,
      );
      params.append("code", code);
      params.append("redirect_uri", redirectUri);

      const tokenResponse = await axios.post<{
        access_token?: string;
        refresh_token?: string;
        error?: string;
        error_description?: string;
      }>(providerConfig.tokenUrl, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        timeout: 10000,
      });

      if (tokenResponse.data.error) {
        throw new AuthorizationError(
          tokenResponse.data.error_description || tokenResponse.data.error,
        );
      }

      if (!tokenResponse.data.access_token) {
        throw new AuthenticationError(
          "No access token received from OAuth provider",
        );
      }

      accessTokenForAPI = tokenResponse.data.access_token;
      newRefreshToken =
        tokenResponse.data.refresh_token || tokenResponse.data.access_token;
    } else {
      accessTokenForAPI = refreshToken as string;
    }

    const userResponse = await axios.get<Record<string, unknown>>(
      providerConfig.userUrl,
      {
        headers: {
          Authorization: `Bearer ${accessTokenForAPI}`,
          Accept: "application/json",
        },
        timeout: 10000,
      },
    );

    console.log("User info response:", userResponse.data);

    let userId: string;
    const identifierField = providerConfig.userIdentifier;

    if (userResponse.data[identifierField]) {
      userId = String(userResponse.data[identifierField]);
    } else if (
      project.oauth &&
      project.oauth?.jwt.identifier &&
      userResponse.data[project.oauth.jwt.identifier]
    ) {
      userId = String(userResponse.data[project.oauth.jwt.identifier]);
    } else {
      console.error("User identifier extraction failed:", {
        availableFields: Object.keys(userResponse.data),
        expectedField: identifierField,
        fallbackField: project.oauth?.jwt.identifier,
      });
      throw new Error(
        `Cannot find user identifier in ${identityProvider} OAuth response`,
      );
    }

    let accessToken: string;

    if (projectId) {
      const permissions = await Permission.findAll({
        where: { userId, projectId, appId },
      });

      if (!permissions.length) {
        accessToken = jwt.sign(
          {
            sub: userId,
            iss: "nuc",
            aid: appId,
            identityProvider: identityProvider,
            iat: Math.floor(Date.now() / 1000),
          },
          process.env.JWT_SECRET as string,
          { expiresIn: "12h" },
        );
      } else {
        accessToken = jwt.sign(
          {
            sub: userId,
            iss: "nuc",
            aud: projectId,
            oid: permissions[0].organizationId,
            aid: appId,
            rls: permissions.map((permission) => permission.role),
            identityProvider: identityProvider,
            iat: Math.floor(Date.now() / 1000),
          },
          process.env.JWT_SECRET as string,
          { expiresIn: "12h" },
        );
      }
    } else {
      accessToken = jwt.sign(
        {
          sub: userId,
          iss: "nuc",
          aid: appId,
          identityProvider: identityProvider,
          iat: Math.floor(Date.now() / 1000),
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "12h" },
      );
    }

    res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  },
);

router.get("/user", async (req: Request, res: Response): Promise<Response> => {
  const authHeader = req.headers.authorization;
  const refreshTokenHeader = req.headers["x-refresh-token"] as
    | string
    | undefined;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).end();
  }

  if (!refreshTokenHeader) {
    return res.status(400).send("Missing refresh token");
  }

  const token = authHeader.split(" ")[1];

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      sub: string;
      identityProvider: string;
    };
  } catch (_) {
    return res.status(401).end();
  }

  const userId = decoded.sub;
  const identityProvider = decoded.identityProvider;

  if (!userId || !identityProvider) {
    return res.status(401).end();
  }

  if (identityProvider.toUpperCase() === "DEMO") {
    const avatarSeed = userId || "1001";
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

    return res.status(200).json({
      user: {
        id: userId || "1001",
        identityProvider: "DEMO",
        name: "admin",
        displayName: "Demo Admin",
        avatarUrl,
        email: "admin@demo.local",
      },
    });
  }

  if (identityProvider.toUpperCase() === "COGNITO") {
    const avatarSeed = userId;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

    return res.status(200).json({
      user: {
        id: userId,
        identityProvider: "COGNITO",
        name: "Cognito",
        displayName: "Cognito Admin",
        avatarUrl,
      },
    });
  }

  const providerConfig = getProviderConfig(identityProvider) as {
    userUrl: string;
    userFields: {
      name: string;
      displayName: string;
      avatarUrl: string;
      email: string;
    };
  };
  if (!providerConfig) {
    return res.status(400).send("Unsupported OAuth provider");
  }

  const userResponse = await axios.get<Record<string, unknown>>(
    providerConfig.userUrl,
    {
      headers: {
        Authorization: `Bearer ${refreshTokenHeader}`,
        Accept: "application/json",
      },
      timeout: 10000,
    },
  );

  const userFieldMapping = providerConfig.userFields;
  const userDetails = {
    id: userId,
    identityProvider: identityProvider,
    name: (userResponse.data[userFieldMapping.name] as string) || null,
    displayName:
      (userResponse.data[userFieldMapping.displayName] as string) || null,
    avatarUrl:
      (userResponse.data[userFieldMapping.avatarUrl] as string) || null,
    email: (userResponse.data[userFieldMapping.email] as string) || null,
  };

  return res.status(200).json({
    user: userDetails,
  });
});

export default router;
