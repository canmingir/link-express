const Project = require("./Project");
const Organization = require("./Organization");
const Permission = require("./Permission");

let _init = false;

async function init() {
  if (!_init) {
    _init = true;
  } else {
    return false;
  }

  Project.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

  Organization.hasMany(Project, {
    foreignKey: "organizationId",
    as: "projects",
  });

  Project.hasMany(Permission, {
    foreignKey: "projectId",
    as: "permissions",
  });

  Organization.addHook("beforeDestroy", async (organization) => {
    await Project.destroy({
      where: {
        organizationId: organization.id,
      },
    });
  });

  return true;
}

module.exports = { Project, Organization, Permission, init };
