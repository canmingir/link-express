const Joi = require("joi");

const SettingSchemas = Joi.object({
  settings: Joi.object({
    timeZone: Joi.string().required(),
  }).required(),
});

module.exports = { SettingSchemas };
