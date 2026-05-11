import Joi from "joi";

const notebookPath = Joi.string()
  .allow("")
  .pattern(/^(\/[\w\- ]+)*$/)
  .message("path must be empty or a slash-separated string like /folder/sub");

const Notebook = {
  create: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    path: notebookPath.default(""),
  }),

  update: Joi.object({
    title: Joi.string().min(1).max(255),
    path: notebookPath,
  }).min(1),

  movePath: Joi.object({
    oldPath: notebookPath.min(1).required(),
    newPath: notebookPath.min(1).required(),
  }),
};

export = Notebook;
