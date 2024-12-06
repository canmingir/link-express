const router = require("express").Router();

const settings = require("../lib/settings");

router.get("/", async (req, res) => {
  const setting = await settings.get(req.session);

  res.json(setting);
});

router.patch("/", async (req, res) => {
  const setting = await settings.update(req.session, req.body);

  res.json(setting);
});

module.exports = router;
