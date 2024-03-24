const Joi = require("joi");

const validate = (schema) => (req, res, next) => {
  Joi.attempt(req.body, schema);
  next();
};

module.exports = validate;
