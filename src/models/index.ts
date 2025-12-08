import Project from "./Project.model";
import Organization from "./Organization.model";
import Permission from "./Permission.model";
import Setting from "./Settings.model";

let _init = false;

async function init(): Promise<boolean> {
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

  Organization.addHook("beforeDestroy", async (organization: Organization) => {
    await Project.destroy({
      where: {
        organizationId: organization.getDataValue("id"),
      },
    });
  });

  return true;
}

export { Project, Organization, Permission, init, Setting };
