const Project = require("./Project");
const Organization = require("./Organization");
const Permission = require("./Permission");

async function init() {
  Project;
  Organization;
  Permission;
}

module.exports = { Project, Organization, Permission, init };
