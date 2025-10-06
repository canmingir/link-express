const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { equal, deepEqual } = require("assert");
const config = require("../../config");
const { project } = config();

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const mock = new MockAdapter(axios);

describe("OAuth", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("returns accessToken and refreshToken with code", async () => {
    const provider = "github";
    const providerConfig = project.oauth.providers[provider];

    mock.onPost(providerConfig.tokenUrl).reply(200, {
      access_token: "c9Q2KuluvCGdM4YZiUnGWxImvuFnbv",
      token_type: "bearer",
      scope: "user",
    });

    mock.onGet(providerConfig.userUrl).reply(200, { id: "1001" });

    const {
      body: { accessToken, refreshToken },
    } = await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        redirectUri: providerConfig.redirectUri,
        code: "vImIDQtMVcYnUCI3Brp6",
        provider: provider,
      })
      .expect(200);

    const payload = jwt.decode(accessToken);

    equal(payload.iss, "nuc");
    equal(payload.aud, "cb16e069-6214-47f1-9922-1f7fe7629525");
    equal(payload.sub, `1001`);
    deepEqual(payload.rls, ["OWNER"]);
    equal(payload.aid, "977f5f57-8936-4388-8eb0-00a512cf01cc");
    equal(payload.oid, "dfb990bb-81dd-4584-82ce-050eb8f6a12f");
    equal(payload.provider, provider);
    equal(refreshToken, "c9Q2KuluvCGdM4YZiUnGWxImvuFnbv");
  });

  it("returns accessToken and refreshToken with refresh token", async () => {
    const provider = "github";
    const providerConfig = project.oauth.providers[provider];

    mock
      .onGet(providerConfig.userUrl)
      .reply(200, { id: "liam@rebellioncoffee.shop" });

    const {
      body: { accessToken, refreshToken },
    } = await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        refreshToken: "lzk7FZGga5hHrfiAePtswijiJHIOev",
        provider: provider,
      })
      .expect(200);

    const payload = jwt.decode(accessToken);

    equal(payload.sub, `liam@rebellioncoffee.shop`);
    equal(payload.iss, "nuc");
    equal(payload.provider, provider);
    equal(refreshToken, "lzk7FZGga5hHrfiAePtswijiJHIOev");
  });

  it("returns 400 if code and refreshToken are missing", async () => {
    await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        provider: "github",
      })
      .expect(400);
  });

  it("returns 401 if code is invalid", async () => {
    const provider = "github";
    const providerConfig = project.oauth.providers[provider];

    mock.onPost(providerConfig.tokenUrl).reply(200, {
      error: "bad_verification_code",
    });
    mock.onGet(providerConfig.userUrl).reply(401);

    const res = await request(app).post("/oauth").send({
      appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
      code: "ZpodRqsLu2EJxbVrcqnV",
      redirectUri: providerConfig.redirectUri,
      provider: provider,
    });
    equal(res.status, 401);
  });

  it("returns 503 if OAuth Provider is not accessible", async () => {
    const provider = "github";
    const providerConfig = project.oauth.providers[provider];

    mock.onPost(providerConfig.tokenUrl).networkError();
    mock.onGet(providerConfig.userUrl).networkError();

    await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        refreshToken: "WnhGHF55s6HFRgpRL9AcV2N2VcYemj",
        provider: provider,
      })
      .expect(503);

    await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        code: "RwlaK2waOdbAa4tt19RF",
        redirectUri: providerConfig.redirectUri,
        provider: provider,
      })
      .expect(503);
  });
});
