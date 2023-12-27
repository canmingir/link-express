const AWS = require("aws-sdk");
const config = require("../config");
const cfg = config.get().dynamo;

AWS.config.update({
  region: cfg.region,
  accessKeyId: cfg.accessKeyId,
  secretAccessKey: cfg.secretAccessKey,
});

const db = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

module.exports = db;
