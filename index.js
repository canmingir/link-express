const config = require("./config");
const sequelize = require("sequelize");
const express = require("express");
const joi = require("joi");
const database = require("./src/database");
const aws = require("aws-sdk");

function init({ settings, db = null, models = null, dynamo = false }) {
  config.copy(settings);

  const app = require("./src/app");

  if (models && db) {
    database.init({ db, models });
  }

  let dynamodb;
  if (dynamo) {
    dynamodb = require("./src/dynamo");
  }

  return { app, dynamodb, database };
}

module.exports = { init, database, config, aws, joi, sequelize, express };
