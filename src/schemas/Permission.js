const Joi = require("joi");

const Permission = {
  create: Joi.object({
    appId: Joi.string().required(),
    organizationId: Joi.string().required(),
    projectId: Joi.string().guid().required(),
    userId: Joi.string().required(),
    role: Joi.string().required(),
  }).required(),
  list: Joi.object({
    appId: Joi.string().required(),
    organizationId: Joi.string().required(),
    projectId: Joi.string().guid().required(),
    userId: Joi.string().required(),
    role: Joi.string().optional(),
  }).required(),
};

module.exports = Permission;
