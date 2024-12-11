const express = require("express");
const router = express.Router({ mergeParams: true });

const settings = require("../lib/settings");
const { AuthorizationError } = require("../error");

router.get("/", async (req, res) => {
  if (req.params.projectId !== req.session.projectId) {
    throw new AuthorizationError();
  }

  const setting = await settings.get(req.session, req.params);
  res.json(setting);
});

router.patch("/", async (req, res) => {
  if (req.params.projectId !== req.session.projectId) {
    throw new AuthorizationError();
  }

  await settings.upsert(req.session, req.body, req.params);
  res.end();
});

module.exports = router;
