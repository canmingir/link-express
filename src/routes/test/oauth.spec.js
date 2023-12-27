/*
require("dotenv").config({ path: ".env.test" });

const request = require("supertest");
const app = require("../../app");
const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const jwt = require("jsonwebtoken");
const config = require("../../../config.json");
const { equal } = require("assert");
const github = require("./github.json");

const mock = new MockAdapter(axios);

const user = new Date().valueOf();
const provider = config[config.oauth_provider];

describe("Oauth service", () => {
  it("returns access_token and refresh_token with code", async () => {
    mock
      .onPost(provider.token_url)
      .reply(
        200,
        "access_token=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&scope=user&token_type=bearer"
      );

    mock.onGet(provider.user_url).reply(200, { id: user, ...github });

    const {
      body: { access_token, refresh_token },
    } = await request(app)
      .post("/oauth")
      .send({ code: "1234567890" })
      .expect(200);

    const payload = jwt.decode(access_token);

    equal(payload.sub, user);
    equal(payload.iss, "nuc");
    equal(refresh_token, "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");
  });

  it("returns access_token and refresh_token with refresh token", async () => {
    mock.onGet(provider.user_url).reply(200, { id: user, ...github });

    const {
      body: { access_token, refresh_token },
    } = await request(app)
      .post("/oauth")
      .send({ refresh_token: "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" })
      .expect(200);

    const payload = jwt.decode(access_token);

    equal(payload.sub, user);
    equal(payload.iss, "nuc");
    equal(refresh_token, "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");
  });

  it("returns 401 if code is invalid", async () => {
    mock.onPost(provider.token_url).reply(200, "error=bad_verification_code");
    mock.onGet(provider.user_url).reply(401);

    const res1 = await request(app).post("/oauth").send({ code: "1234567890" });
    equal(res1.status, 401);
  });

  it("returns 503 if Oauth Provider is not accessible", async () => {
    mock.onPost(provider.token_url).networkError();
    mock.onGet(provider.user_url).networkError();

    await request(app)
      .post("/oauth")
      .send({ refresh_token: "REFRESH_TOKEN" })
      .expect(503);

    await request(app).post("/oauth").send({ code: "CODE" }).expect(503);
  });
});
*/
