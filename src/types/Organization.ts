import type { PermissionType } from "./Permission";
import type { ProjectType } from "./Project";

export interface OrganizationType {
  id: string;
  name: string;
  permissions?: PermissionType[];
  projects?: ProjectType[];
}
