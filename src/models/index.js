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

  Organization.addHook("beforeDestroy", async (organization) => {
    await Project.destroy({
      where: {
        organizationId: organization.id,
      },
    });
  });

  Project.hasMany(Permission, {
    foreignKey: "projectId",
  });
}

module.exports = { Project, Organization, Permission, init };
