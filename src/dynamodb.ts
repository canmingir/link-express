import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "./config";
import dotenv from "dotenv";

dotenv.config();

const { dynamodb } = getConfig();

if (!dynamodb) {
  throw new Error("DynamoDB configuration is required");
}

const client = new DynamoDBClient({
  region: dynamodb.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export { docClient };
