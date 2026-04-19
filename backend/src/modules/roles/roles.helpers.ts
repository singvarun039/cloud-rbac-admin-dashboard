import { prisma } from '../../db/prisma';

// Maps a Prisma role record into the API response shape.
export function roleToApi(role: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  permissions?: Array<{ permission: { id: string; key: string } }>;
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    ...(role.permissions
      ? {
          permissions: role.permissions
            .map((rp) => rp.permission)
            .sort((a, b) => a.key.localeCompare(b.key)),
        }
      : {}),
  };
}

export const PROTECTED_ROLE_NAMES = new Set(['ADMIN', 'EDITOR', 'USER', 'VIEWER']);

// Returns the select shape for a role with permissions.
export function roleWithPermissionsSelect() {
  return {
    id: true,
    name: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    permissions: {
      select: { permission: { select: { id: true, key: true } } },
      orderBy: { permission: { key: 'asc' } },
    },
  } as const;
}
