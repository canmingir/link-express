const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("../../config");
const { AuthenticationError } = require("../error");
const provider = config?.get()?.oauth[config?.get()?.oauth?.oauth_provider];

const getAccessToken = async (code) => {
  const params = new URLSearchParams();

  params.append("client_id", provider.client_id);
  params.append("client_secret", provider.client_secret);
  params.append("code", code);
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", provider.redirect_uri);

  return axios.post(provider.token_url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

const getUser = async (token) => {
  return axios.get(provider.user_url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const generateJwtToken = (userId) => {
  return jwt.sign(
    { sub: userId, iss: "nuc" },
    config?.get()?.oauth?.jwt_secret,
    {
      expiresIn: "24h",
    }
  );
};

router.post("/", async (req, res, next) => {
  try {
    const code = req?.body["code"];
    const refreshToken = req?.body["refresh_token"];

    let token;

    if (code) {
      const { data } = await getAccessToken(code);

      const urlParams = new URLSearchParams(data);
      if (urlParams.get("error")) {
        throw Error(urlParams.get("error_description"));
      }
      token = urlParams.get("access_token");
    } else if (refreshToken) {
      token = refreshToken;
    } else {
      throw Error("Missing OAuth Code or Refresh Token");
    }

    const response = await getUser(token);
    if (response && response.data && response.data.id) {
      const jwtToken = generateJwtToken(response.data.id);
      return res.json({ access_token: jwtToken, refresh_token: token });
    } else {
      throw Error("Invalid Response from OAuth Provider");
    }
  } catch (err) {
    if (err.isAxiosError) {
      return res.status(503).end();
    }

    next(new AuthenticationError());
  }
});

module.exports = router;
