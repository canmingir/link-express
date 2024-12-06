const Joi = require("joi");

const SettingSchemas = Joi.object({
  details: Joi.object({
    timeZone: Joi.string().required(),
  }).required(),
});

module.exports = { SettingSchemas };
