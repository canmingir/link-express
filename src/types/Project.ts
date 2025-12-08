import type { OrganizationType } from "./Organization";
import type { PermissionType } from "./Permission";

export interface ProjectType {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  type: string | null;
  organizationId: string | null;
  coach: string | null;
  organization?: OrganizationType;
  permissions?: PermissionType[];
}
