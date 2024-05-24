const oauth = {
  jwt: {
    identifier: "email",
  },
  tokenUrl: "https://github.com/login/oauth/access_token",
  userUrl: "https://api.github.com/user",
  clientId: "0c2844d3d19dc9293fc5",
  redirectUri: "http://localhost:5173/callback",
};

const postgres = {
  uri: "sqlite::memory:",
  debug: true,
  sync: true,
};

const config = require("../../config");
config.init({ oauth, postgres });

const express = require("express");
require("express-async-errors");

const app = express();
const error = require("../../error");

app.use(express.json());
app.use(express.urlencoded());
app.use("/oauth", require("../oauth"));
app.use("/permissions", require("../permissions"));
app.use(error.handle);

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");

const mock = new MockAdapter(axios);

module.exports = { app, mock, oauth, postgres };
