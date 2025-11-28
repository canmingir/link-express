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

  return true;
}

export { Project, Organization, Permission, init, Setting };
