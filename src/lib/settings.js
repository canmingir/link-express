const Joi = require("joi");
const Settings = require("../models/Settings");
const { SettingSchemas } = require("../schemas/Settings");

async function get(session, params) {
  const projectId = session.projectId;
  const id = params.projectId;

  if (projectId !== id) {
    throw new Error("404 Not Found");
  }

  const settings = await Settings.findAll({
    where: {
      teamId: projectId,
    },
  });

  return settings;
}

async function update(session, body, params) {
  const projectId = session.projectId;
  const id = params.projectId;

  if (projectId !== id) {
    throw new Error("404 Not Found");
  }

  const settings = await Settings.findOne({
    where: {
      teamId: projectId,
    },
  });

  if (settings) {
    const updatedSetting = await Joi.attempt(body, SettingSchemas);
    await settings.update(updatedSetting);
    return settings;
  } else {
    return console.log("Setting not found");
  }
}

module.exports = { get, update };
