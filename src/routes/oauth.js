const Joi = require("joi");
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const config = require("../config");
const { AuthenticationError } = require("../error");
const { oauth } = config();
require("dotenv").config();

router.post("/", async (req, res) => {
  let { code, refreshToken } = Joi.attempt(
    req.body,
    Joi.object({
      code: Joi.string().optional(),
      refreshToken: Joi.string().optional(),
    })
      .required()
      .options({ stripUnknown: true })
  );

  if (!code && !refreshToken) {
    return res.status(400).send("Missing OAuth Code and Refresh Token");
  }

  if (code) {
    const params = new URLSearchParams();
    params.append("client_id", oauth.clientId);
    params.append("client_secret", process.env.OAUTH_CLIENT_SECRET);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", oauth.redirectUri);

    const { data } = await axios.post(oauth.tokenUrl, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const urlParams = new URLSearchParams(data);

    if (urlParams.get("error")) {
      throw new AuthenticationError(urlParams.get("error_description"));
    }

    refreshToken = urlParams.get("access_token");
  }

  const { data } = await axios.get(oauth.userUrl, {
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });

  const accessToken = jwt.sign(
    { sub: data[oauth.jwt.identifier], iss: "nuc" },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.status(200).json({ accessToken, refreshToken });
});

module.exports = router;
