import Joi from "joi";
import { NotebookBlockType } from "../models/NotebookBlock.model";

const NotebookBlock = {
  create: Joi.object({
    notebookId: Joi.string().guid().required(),
    type: Joi.string()
      .valid(...Object.values(NotebookBlockType))
      .required(),
    content: Joi.string().allow("").required(),
    order: Joi.number().integer().min(0).required(),
  }),

  update: Joi.object({
    type: Joi.string().valid(...Object.values(NotebookBlockType)),
    content: Joi.string().allow(""),
    order: Joi.number().integer().min(0),
  }).min(1),
};

export = NotebookBlock;
