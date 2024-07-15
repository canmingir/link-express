const test = require("../../lib/test");

const platform = require("../../platform");
const app = platform.express();

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { equal } = require("assert");
const config = require("../../config");
const { oauth } = config();

const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const mock = new MockAdapter(axios);

describe("OAuth", () => {
  beforeEach(async () => {
    await test.reset();
  });

  it("returns accessToken and refreshToken with code", async () => {
    mock
      .onPost(oauth.tokenUrl)
      .reply(
        200,
        "access_token=c9Q2KuluvCGdM4YZiUnGWxImvuFnbv&scope=user&token_type=bearer"
      );

    mock.onGet(oauth.userUrl).reply(200, { email: "marcus@nucleoidai.com" });

    const {
      body: { accessToken, refreshToken },
    } = await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        projectId: "cb16e069-6214-47f1-9922-1f7fe7629525",
        redirectUri: oauth.redirectUri,
        code: "vImIDQtMVcYnUCI3Brp6",
      })
      .expect(200);

    const payload = jwt.decode(accessToken);

    equal(payload.iss, "nuc");
    equal(payload.aud, "cb16e069-6214-47f1-9922-1f7fe7629525");
    equal(payload.sub, "marcus@nucleoidai.com");
    equal(payload.rls, "OWNER");
    equal(payload.aid, "977f5f57-8936-4388-8eb0-00a512cf01cc");
    equal(payload.oid, "dfb990bb-81dd-4584-82ce-050eb8f6a12f");
    equal(refreshToken, "c9Q2KuluvCGdM4YZiUnGWxImvuFnbv");
  });

  it("returns accessToken and refreshToken with refresh token", async () => {
    mock.onGet(oauth.userUrl).reply(200, { email: "liam@imaginecoffee.shop" });

    const {
      body: { accessToken, refreshToken },
    } = await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        refreshToken: "lzk7FZGga5hHrfiAePtswijiJHIOev",
      })
      .expect(200);

    const payload = jwt.decode(accessToken);

    equal(payload.sub, "liam@imaginecoffee.shop");
    equal(payload.iss, "nuc");
    equal(refreshToken, "lzk7FZGga5hHrfiAePtswijiJHIOev");
  });

  it("returns 400 if code and refreshToken are missing", async () => {
    await request(app).post("/oauth").send({}).expect(400);
  });

  it("returns 401 if code is invalid", async () => {
    mock.onPost(oauth.tokenUrl).reply(200, "error=bad_verification_code");
    mock.onGet(oauth.userUrl).reply(401);

    const res = await request(app).post("/oauth").send({
      appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
      code: "ZpodRqsLu2EJxbVrcqnV",
    });
    equal(res.status, 401);
  });

  it("returns 503 if OAuth Provider is not accessible", async () => {
    mock.onPost(oauth.tokenUrl).networkError();
    mock.onGet(oauth.userUrl).networkError();

    await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        refreshToken: "WnhGHF55s6HFRgpRL9AcV2N2VcYemj",
      })
      .expect(503);

    await request(app)
      .post("/oauth")
      .send({
        appId: "977f5f57-8936-4388-8eb0-00a512cf01cc",
        code: "RwlaK2waOdbAa4tt19RF",
      })
      .expect(503);
  });
});
