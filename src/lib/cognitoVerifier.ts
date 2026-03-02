import { CognitoJwtVerifier } from "aws-jwt-verify";

export const cognitoAccessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export async function verifyCognitoAccessToken(token: string) {
  return cognitoAccessTokenVerifier.verify(token);
}
