import Joi from "joi";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import config from "../config";
import { AuthenticationError, AuthorizationError } from "../error";
import Permission from "../models/Permission.model";

const router = express.Router();

const { project } = config();

if (!project) {
  throw new Error("Project configuration is required");
}

router.post(
  "/",
  async (req: Request, res: Response): Promise<Response | void> => {
    const { appId, projectId, code, refreshToken, redirectUri, provider } =
      Joi.attempt(
        req.body,
        Joi.object({
          appId: Joi.string().required(),
          projectId: Joi.string().optional(),
          code: Joi.string().optional(),
          refreshToken: Joi.string().optional(),
          redirectUri: Joi.string().optional(),
          provider: Joi.string().required(),
        })
          .required()
          .options({ stripUnknown: true })
      ) as {
        appId: string;
        projectId?: string;
        code?: string;
        refreshToken?: string;
        redirectUri?: string;
        provider: string;
      };

    if (!code && !refreshToken) {
      return res.status(400).send("Missing OAuth Code and Refresh Token");
    }

    const providerConfig = project.oauth?.providers[provider] as {
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
        process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] as string
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
          tokenResponse.data.error_description || tokenResponse.data.error
        );
      }

      if (!tokenResponse.data.access_token) {
        throw new AuthenticationError(
          "No access token received from OAuth provider"
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
      }
    );

    console.log("User info response:", userResponse.data);

    let userId: string;
    const identifierField = providerConfig.userIdentifier;

    if (userResponse.data[identifierField]) {
      userId = String(userResponse.data[identifierField]);
    } else if (
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
        `Cannot find user identifier in ${provider} OAuth response`
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
            provider: provider,
            iat: Math.floor(Date.now() / 1000),
          },
          process.env.JWT_SECRET as string,
          { expiresIn: "12h" }
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
            provider: provider,
            iat: Math.floor(Date.now() / 1000),
          },
          process.env.JWT_SECRET as string,
          { expiresIn: "12h" }
        );
      }
    } else {
      accessToken = jwt.sign(
        {
          sub: userId,
          iss: "nuc",
          aid: appId,
          provider: provider,
          iat: Math.floor(Date.now() / 1000),
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "12h" }
      );
    }

    res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  }
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

  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
    sub: string;
    provider: string;
  };
  const userId = decoded.sub;
  const provider = decoded.provider;

  if (!userId || !provider) {
    return res.status(401).end();
  }

  const providerConfig = project.oauth?.providers[provider] as {
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
    }
  );

  const userFieldMapping = providerConfig.userFields;
  const userDetails = {
    id: userId,
    provider: provider,
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

export = router;
