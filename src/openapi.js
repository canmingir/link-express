const { title, version } = require("./config")();
const swaggerJsdoc = require("swagger-jsdoc");
const j2s = require("joi-to-swagger");

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title, version },
    servers: [{ url: "/api" }],
  },

  apis: [`${process.cwd()}/src/routes/*.js`],
});

swaggerSpec.components = {
  schemas: {},
};

let schemas;
try {
  schemas = require(`${process.cwd()}/src/schemas`);
} catch (error) {
  console.warn("[NUC]: Could not load schemas");
  schemas = {};
}

if (schemas && typeof schemas === "object") {
  if (schemas.default) {
    for (const schema in schemas) {
      try {
        const { swagger } = j2s(schemas[schema]);
        swaggerSpec.components.schemas[schema] = swagger;
      } catch (error) {
        console.warn(`Warning: Failed to process schema "${schema}":`);
      }
    }
  }
}

module.exports = swaggerSpec;
