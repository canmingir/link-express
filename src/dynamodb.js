const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const config = require("./config");
require("dotenv").config();

const { dynamodb } = config();

const client = new DynamoDBClient({
  region: dynamodb.region,
  credentials: {
    accessKeyId: process.env.awsaccesskeyid,
    secretAccessKey: process.env.awssecretaccesskey,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

module.exports = { docClient };
