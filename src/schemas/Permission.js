const Joi = require("joi");

module.exports = {
  create: Joi.object({
    appId: Joi.string().required(),
    companyId: Joi.string().required(),
    projectId: Joi.string().guid().required(),
    userId: Joi.string().required(),
    role: Joi.string().required(),
  }).required(),
  list: Joi.object({
    appId: Joi.string().required(),
    companyId: Joi.string().required(),
    projectId: Joi.string().guid().required(),
    userId: Joi.string().required(),
  }).required(),
};
