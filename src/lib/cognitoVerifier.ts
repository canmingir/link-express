import { CognitoJwtVerifier } from "aws-jwt-verify";

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

if (!userPoolId || !clientId) {
  console.warn(
    "Cognito is not fully configured. Missing COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID.",
  );
}

const cognitoAccessTokenVerifier =
  userPoolId && clientId
    ? CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: "access",
        clientId,
      })
    : null;

export async function verifyCognitoAccessToken(token: string) {
  if (!cognitoAccessTokenVerifier) {
    throw new Error(
      "Cognito is not configured. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.",
    );
  }

  return cognitoAccessTokenVerifier.verify(token);
}
