import type { OrganizationType } from "./Organization";
import type { ProjectType } from "./Project";

export interface PermissionType {
  id: string;
  appId: string;
  organizationId: string;
  projectId: string;
  userId: string;
  role: string;
  organization?: OrganizationType;
  project?: ProjectType;
}
