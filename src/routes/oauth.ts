import { AuthenticationError, AuthorizationError } from "../error";
import express, { Request, Response } from "express";

import Joi from "joi";
import Permission from "../models/Permission.model";
import axios from "axios";
import config from "../config";
import jwt from "jsonwebtoken";

const router = express.Router();

const { project } = config();

if (!project) {
  throw new Error("Project configuration is required");
}

if (!project.oauth) {
  throw new Error("OAuth configuration is required");
}

const oauthConfig = project.oauth;

const MOCK_OAUTH_ENABLED = oauthConfig.mock?.enabled || false;

const MOCK_USER_ID = oauthConfig.mock?.userId || "1001";

const getMockUserData = (identityProvider: string) => {
  const mockUsers: Record<string, Record<string, unknown>> = {
    github: {
      id: Number(MOCK_USER_ID),
      login: "demo-user",
      name: "Demo User",
      email: "demo@example.com",
      avatar_url: `https://avatars.githubusercontent.com/u/${MOCK_USER_ID}`,
      bio: "Demo user for testing",
      company: "Demo Company",
      location: "Demo Location",
    },
    google: {
      sub: MOCK_USER_ID,
      id: MOCK_USER_ID,
      name: "Demo User",
      given_name: "Demo",
      family_name: "User",
      picture: "https://lh3.googleusercontent.com/a/default-user",
      email: "demo@example.com",
      email_verified: true,
    },
  };

  return mockUsers[identityProvider] || mockUsers.github;
};

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
    } = Joi.attempt(
      req.body,
      Joi.object({
        appId: Joi.string().required(),
        projectId: Joi.string().optional(),
        code: Joi.string().optional(),
        refreshToken: Joi.string().optional(),
        redirectUri: Joi.string().optional(),
        identityProvider: Joi.string().required(),
      })
        .required()
        .options({ stripUnknown: true })
    ) as {
      appId: string;
      projectId?: string;
      code?: string;
      refreshToken?: string;
      redirectUri?: string;
      identityProvider: string;
    };

    if (!code && !refreshToken) {
      return res.status(400).send("Missing OAuth Code and Refresh Token");
    }

    const providerConfig = oauthConfig.providers[identityProvider] as {
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
    let userResponseData: Record<string, unknown>;

    if (MOCK_OAUTH_ENABLED) {
      console.log("🎭 Mock OAuth mode enabled - using mock user data");
      accessTokenForAPI = `mock_access_token_${Date.now()}`;
      newRefreshToken = `mock_refresh_token_${Date.now()}`;
      userResponseData = getMockUserData(identityProvider);
      console.log("Mock user data:", userResponseData);
    } else {
      if (code && redirectUri) {
        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("client_id", providerConfig.clientId);
        params.append(
          "client_secret",
          process.env[
            `${identityProvider.toUpperCase()}_CLIENT_SECRET`
          ] as string
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

      userResponseData = userResponse.data;
      console.log("User info response:", userResponseData);
    }

    let userId: string;
    const identifierField = providerConfig.userIdentifier;

    if (userResponseData[identifierField]) {
      userId = String(userResponseData[identifierField]);
    } else if (
      oauthConfig.jwt.identifier &&
      userResponseData[oauthConfig.jwt.identifier]
    ) {
      userId = String(userResponseData[oauthConfig.jwt.identifier]);
    } else {
      console.error("User identifier extraction failed:", {
        availableFields: Object.keys(userResponseData),
        expectedField: identifierField,
        fallbackField: oauthConfig.jwt.identifier,
      });
      throw new Error(
        `Cannot find user identifier in ${identityProvider} OAuth response`
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
            identityProvider: identityProvider,
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
          identityProvider: identityProvider,
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
    identityProvider: string;
  };
  const userId = decoded.sub;
  const identityProvider = decoded.identityProvider;

  if (!userId || !identityProvider) {
    return res.status(401).end();
  }

  const providerConfig = oauthConfig.providers[identityProvider] as {
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

  let userResponseData: Record<string, unknown>;

  if (MOCK_OAUTH_ENABLED) {
    console.log("🎭 Mock OAuth mode enabled - using mock user data for /user");
    userResponseData = getMockUserData(identityProvider);
  } else {
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
    userResponseData = userResponse.data;
  }

  const userFieldMapping = providerConfig.userFields;
  const userDetails = {
    id: userId,
    identityProvider: identityProvider,
    name: (userResponseData[userFieldMapping.name] as string) || null,
    displayName:
      (userResponseData[userFieldMapping.displayName] as string) || null,
    avatarUrl: (userResponseData[userFieldMapping.avatarUrl] as string) || null,
    email: (userResponseData[userFieldMapping.email] as string) || null,
  };

  return res.status(200).json({
    user: userDetails,
  });
});

router.get(
  "/mock/github/user",
  async (req: Request, res: Response): Promise<Response> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Requires authentication",
        documentation_url: "https://docs.github.com/rest",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token.startsWith("mock_refresh_token_")) {
      return res.status(401).json({
        message: "Bad credentials",
        documentation_url: "https://docs.github.com/rest",
      });
    }

    const mockData = getMockUserData("github");
    return res.status(200).json(mockData);
  }
);

router.get(
  "/mock/google/user",
  async (req: Request, res: Response): Promise<Response> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          code: 401,
          message: "Invalid Credentials",
          status: "UNAUTHENTICATED",
        },
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token.startsWith("mock_refresh_token_")) {
      return res.status(401).json({
        error: {
          code: 401,
          message: "Invalid Credentials",
          status: "UNAUTHENTICATED",
        },
      });
    }

    const mockData = getMockUserData("google");
    return res.status(200).json(mockData);
  }
);

export default router;
