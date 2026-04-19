export type AccessSurface = {
  kind: "page" | "api";
  key: string;
  label: string;
  description: string;
  requiredAnyOf: string[];
};

export type SurfaceImpact = {
  kind: "page" | "api";
  key: string;
  label: string;
  description: string;
  requiredAnyOf: string[];
};

export const APP_ACCESS_SURFACES: AccessSurface[] = [
  { kind: "page", key: "page.users", label: "Users page", description: "View the users management screen.", requiredAnyOf: ["users.read"] },
  { kind: "page", key: "page.roles", label: "Roles page", description: "View the roles management screen.", requiredAnyOf: ["roles.read"] },
  { kind: "page", key: "page.projects", label: "Projects page", description: "View the projects screen.", requiredAnyOf: ["projects.read"] },
  { kind: "page", key: "page.auditLogs", label: "Audit Logs page", description: "View the audit logs screen.", requiredAnyOf: ["audit.read"] },
  { kind: "api", key: "api.users.list", label: "List users", description: "Read the users API listing.", requiredAnyOf: ["users.read"] },
  { kind: "api", key: "api.users.create", label: "Create users", description: "Create new users through the API.", requiredAnyOf: ["users.write"] },
  { kind: "api", key: "api.users.edit", label: "Edit users", description: "Update existing users through the API.", requiredAnyOf: ["users.write", "users.edit"] },
  { kind: "api", key: "api.roles.list", label: "List roles", description: "Read the roles API listing.", requiredAnyOf: ["roles.read"] },
  { kind: "api", key: "api.roles.create", label: "Create roles", description: "Create new roles through the API.", requiredAnyOf: ["roles.write"] },
  { kind: "api", key: "api.roles.edit", label: "Edit roles", description: "Update role metadata through the API.", requiredAnyOf: ["roles.write", "roles.edit"] },
  { kind: "api", key: "api.roles.permissions", label: "Update role permissions", description: "Change permission assignments on roles.", requiredAnyOf: ["roles.write", "roles.edit"] },
  { kind: "api", key: "api.projects.list", label: "List projects", description: "Read the projects API listing.", requiredAnyOf: ["projects.read"] },
  { kind: "api", key: "api.projects.create", label: "Create projects", description: "Create new projects through the API.", requiredAnyOf: ["projects.write"] },
  { kind: "api", key: "api.projects.edit", label: "Edit projects", description: "Update projects through the API.", requiredAnyOf: ["projects.write", "projects.edit"] },
  { kind: "api", key: "api.permissions.list", label: "List permissions", description: "Read the permissions catalog.", requiredAnyOf: ["permissions.read"] },
  { kind: "api", key: "api.audit.list", label: "Read audit logs", description: "Read audit log records.", requiredAnyOf: ["audit.read"] },
];

export function hasAnyPermission(permissionKeys: Set<string>, requiredAnyOf: string[]): boolean {
  return requiredAnyOf.some((key) => permissionKeys.has(key));
}
