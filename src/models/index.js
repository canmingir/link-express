const Project = require("./Project");
const Organization = require("./Organization");
const Permission = require("./Permission");

async function init() {
  Project.belongsTo(Organization, {
    foreignKey: "organizationId",
  });

  Organization.hasMany(Project, {
    foreignKey: "organizationId",
  });
  Permission;
}

module.exports = { Project, Organization, Permission, init };
