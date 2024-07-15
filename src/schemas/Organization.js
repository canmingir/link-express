const Joi = require("joi");

const Organization = {
  create: Joi.object({
    name: Joi.string().required(),
  }).required(),
  list: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }),
    name: Joi.string(),
  }).required(),
};

module.exports = Organization;
