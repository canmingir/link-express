const AWS = require("aws-sdk");
const config = require("./config");

const {
  dynamodb: { region, accessKeyId, secretAccessKey },
} = config();

AWS.config.update({
  region: region,
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
});

const docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

module.exports = { docClient };
