const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const config = require("./config");
const { dynamodb } = config();

const client = new DynamoDBClient(dynamodb);
const docClient = DynamoDBDocumentClient.from(client);

module.exports = { docClient };
