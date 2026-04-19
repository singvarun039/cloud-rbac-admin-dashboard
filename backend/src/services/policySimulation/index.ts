import { prisma } from '../../db/prisma';
import { AppError } from '../../errors/AppError';
import { APP_ACCESS_SURFACES, hasAnyPermission, type SurfaceImpact } from './surfaces';
import { generateSimulationSummary } from './summary';

export type PolicySimulationResult = {
  role: { id: string; name: string; description: string | null };
  currentPermissionKeys: string[];
  proposedPermissionKeys: string[];
  addedPermissionKeys: string[];
  removedPermissionKeys: string[];
  impacts: {
    losingAccess: SurfaceImpact[];
    gainingAccess: SurfaceImpact[];
    unchangedAccessible: SurfaceImpact[];
  };
  summary: string;
};

// Simulates the impact of replacing a role's permission set before saving it.
export async function simulateRolePolicyChange(input: {
  roleId: string;
  permissionIds?: string[];
  permissionKeys?: string[];
}): Promise<PolicySimulationResult> {
  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        select: { permission: { select: { id: true, key: true } } },
        orderBy: { permission: { key: 'asc' } },
      },
    },
  });

  if (!role) throw AppError.notFound('Role not found');

  let proposedPermissions: Array<{ id: string; key: string }> = [];

  if (Array.isArray(input.permissionKeys) && input.permissionKeys.length > 0) {
    proposedPermissions = await prisma.permission.findMany({
      where: { key: { in: input.permissionKeys } },
      select: { id: true, key: true },
    });
    const foundKeys = new Set(proposedPermissions.map((p) => p.key));
    const invalid = input.permissionKeys.filter((k) => !foundKeys.has(k));
    if (invalid.length > 0) throw AppError.validation({ invalidPermissionKeys: invalid });
  } else if (Array.isArray(input.permissionIds) && input.permissionIds.length > 0) {
    proposedPermissions = await prisma.permission.findMany({
      where: { id: { in: input.permissionIds } },
      select: { id: true, key: true },
    });
    const foundIds = new Set(proposedPermissions.map((p) => p.id));
    const invalid = input.permissionIds.filter((id) => !foundIds.has(id));
    if (invalid.length > 0) throw AppError.validation({ invalidPermissionIds: invalid });
  }

  const currentPermissionKeys = role.permissions.map((p) => p.permission.key);
  const proposedPermissionKeys = proposedPermissions
    .map((p) => p.key)
    .sort((a, b) => a.localeCompare(b));
  const currentSet = new Set(currentPermissionKeys);
  const proposedSet = new Set(proposedPermissionKeys);
  const removedPermissionKeys = currentPermissionKeys.filter((k) => !proposedSet.has(k));
  const addedPermissionKeys = proposedPermissionKeys.filter((k) => !currentSet.has(k));

  const losingAccess: SurfaceImpact[] = [];
  const gainingAccess: SurfaceImpact[] = [];
  const unchangedAccessible: SurfaceImpact[] = [];

  for (const surface of APP_ACCESS_SURFACES) {
    const cur = hasAnyPermission(currentSet, surface.requiredAnyOf);
    const prop = hasAnyPermission(proposedSet, surface.requiredAnyOf);
    const shaped: SurfaceImpact = {
      kind: surface.kind,
      key: surface.key,
      label: surface.label,
      description: surface.description,
      requiredAnyOf: surface.requiredAnyOf,
    };
    if (cur && !prop) losingAccess.push(shaped);
    else if (!cur && prop) gainingAccess.push(shaped);
    else if (cur && prop) unchangedAccessible.push(shaped);
  }

  const summary = await generateSimulationSummary({
    roleName: role.name,
    currentPermissionKeys,
    proposedPermissionKeys,
    removedPermissionKeys,
    addedPermissionKeys,
    losingAccess,
    gainingAccess,
  });

  return {
    role: { id: role.id, name: role.name, description: role.description },
    currentPermissionKeys,
    proposedPermissionKeys,
    addedPermissionKeys,
    removedPermissionKeys,
    impacts: { losingAccess, gainingAccess, unchangedAccessible },
    summary,
  };
}
