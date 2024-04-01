require("dotenv").config({ path: ".env.test" });

const oauth = {
  jwt: {
    identifier: "email",
    secret: "q8fvthcTaz8qKQDAS7hJRK",
  },
  tokenUrl: "https://github.com/login/oauth/access_token",
  userUrl: "https://api.github.com/user",
  clientId: "0c2844d3d19dc9293fc5",
  clientSecret: "53b08fe45a3c616a9ce3e05174ea82e502df6baf",
  redirectUri: "http://localhost:5173/callback",
};
const config = require("../../config");
config.init({ oauth });

const express = require("express");
require("express-async-errors");

const app = express();
const error = require("../../error");

app.use(express.json());
app.use(express.urlencoded());
app.use("/oauth", require("../../routes/oauth"));
app.use(error.handle);

const request = require("supertest");
const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const jwt = require("jsonwebtoken");
const { equal } = require("assert");

const mock = new MockAdapter(axios);

describe("Oauth", () => {
  it("returns accessToken and refreshToken with code", async () => {
    mock
      .onPost(oauth.tokenUrl)
      .reply(
        200,
        "access_token=c9Q2KuluvCGdM4YZiUnGWxImvuFnbv&scope=user&token_type=bearer"
      );

    mock.onGet(oauth.userUrl).reply(200, { email: "test@nucleoid.com" });

    const {
      body: { accessToken, refreshToken },
    } = await request(app)
      .post("/oauth")
      .send({ code: "vImIDQtMVcYnUCI3Brp6" })
      .expect(200);

    const payload = jwt.decode(accessToken);

    equal(payload.sub, "test@nucleoid.com");
    equal(payload.iss, "nuc");
    equal(refreshToken, "c9Q2KuluvCGdM4YZiUnGWxImvuFnbv");
  });

  it("returns accessToken and refreshToken with refresh token", async () => {
    mock.onGet(oauth.userUrl).reply(200, { email: "test@nucleoid.com" });

    const {
      body: { accessToken, refreshToken },
    } = await request(app)
      .post("/oauth")
      .send({ refreshToken: "lzk7FZGga5hHrfiAePtswijiJHIOev" })
      .expect(200);

    const payload = jwt.decode(accessToken);

    equal(payload.sub, "test@nucleoid.com");
    equal(payload.iss, "nuc");
    equal(refreshToken, "lzk7FZGga5hHrfiAePtswijiJHIOev");
  });

  it("returns 400 if code and refreshToken are missing", async () => {
    await request(app).post("/oauth").send({}).expect(400);
  });

  it("returns 401 if code is invalid", async () => {
    mock.onPost(oauth.tokenUrl).reply(200, "error=bad_verification_code");
    mock.onGet(oauth.userUrl).reply(401);

    const res = await request(app)
      .post("/oauth")
      .send({ code: "ZpodRqsLu2EJxbVrcqnV" });
    equal(res.status, 401);
  });

  it("returns 503 if Oauth Provider is not accessible", async () => {
    mock.onPost(oauth.tokenUrl).networkError();
    mock.onGet(oauth.userUrl).networkError();

    await request(app)
      .post("/oauth")
      .send({ refreshToken: "WnhGHF55s6HFRgpRL9AcV2N2VcYemj" })
      .expect(503);

    await request(app)
      .post("/oauth")
      .send({ code: "RwlaK2waOdbAa4tt19RF" })
      .expect(503);
  });
});
