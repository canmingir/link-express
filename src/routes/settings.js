const express = require("express");
const router = express.Router({ mergeParams: true });

const settings = require("../lib/settings");

router.get("/", async (req, res) => {
  try {
    const setting = await settings.get(req.session, req.params);
    res.json(setting);
  } catch (error) {
    res.status(404).end();
  }
});

router.patch("/", async (req, res) => {
  try {
    const setting = await settings.update(req.session, req.body, req.params);
    res.json(setting);
  } catch (error) {
    res.status(404).end();
  }
});

module.exports = router;
