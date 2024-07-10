const Joi = require("joi");

module.exports = {
  name: Joi.string().required(),
  icon: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string().optional(),
  organizationId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
};
