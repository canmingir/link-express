const Joi = require("joi");
const Setting = require("../models/Setting");
const { SettingSchemas } = require("../schemas/Setting");

async function get(session) {
  const projectId = session.projectId;

  return Setting.findAll({
    where: {
      teamId: projectId,
    },
  });
}

async function update(session, body) {
  const projectId = session.projectId;

  const setting = await Setting.findOne({
    where: {
      teamId: projectId,
    },
  });

  if (setting) {
    const updatedSetting = await Joi.attempt(body, SettingSchemas);
    await setting.update(updatedSetting);
    return setting;
  } else {
    return console.log("Setting not found");
  }
}

module.exports = { get, update };
