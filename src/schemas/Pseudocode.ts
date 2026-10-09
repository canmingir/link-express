import Joi from "joi";

const Pseudocode = {
  generate: Joi.object({
    instructions: Joi.string().allow("").required(),
    agentId: Joi.string().uuid(),
  }),
};

export = Pseudocode;
