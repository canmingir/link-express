const swaggerJsdoc = require("swagger-jsdoc");
const { get } = require("../config");
const j2s = require("joi-to-swagger");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: get()?.name, version: get()?.version },
    servers: [{ url: "/api" }],
  },

  apis: [`${process.cwd()}/src/routes/*.js`],
});

swaggerSpec.components = {
  schemas: {},
};

const schemas = require(`${process.cwd()}/src/schemas`);
for (const schema in schemas) {
  const { swagger } = j2s(schemas[schema]);
  swaggerSpec.components.schemas[schema] = swagger;
}

module.exports = swaggerSpec;
