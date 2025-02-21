const Project = require("./Project");
const Organization = require("./Organization");
const Permission = require("./Permission");
const Setting = require("./Settings");

let _init = false;

async function init() {
  if (!_init) {
    _init = true;
  } else {
    return false;
  }

  Organization.hasMany(Permission, {
    foreignKey: "organizationId",
    as: "permissions",
  });

  Permission.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  });

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

module.exports = { Project, Organization, Permission, init, Setting };
