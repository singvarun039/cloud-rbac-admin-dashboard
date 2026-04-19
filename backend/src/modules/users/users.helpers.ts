import { prisma } from '../../db/prisma';

const DEFAULT_ROLE_NAME = 'USER';
const DEFAULT_ROLE_DESCRIPTION = 'Limited read-only access';
const DEFAULT_ROLE_PERMISSION_KEYS = ['users.read', 'projects.read', 'audit.read'] as const;

// Splits a display name into first and last name fields.
export function nameToFirstLast(name: string): { firstName: string; lastName: string | null } {
  const normalized = name.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ');
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  return { firstName, lastName };
}

// Maps a Prisma user record into the API response shape.
export function userToApi(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  roles?: Array<{ role: { id: string; name: string } }>;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
  const status = user.isActive ? 'ACTIVE' : 'INACTIVE';
  const primaryRole = user.roles?.[0]?.role ?? null;
  const roles = user.roles?.map((r) => ({ id: r.role.id, name: r.role.name }));

  return {
    id: user.id,
    email: user.email,
    name,
    status,
    createdAt: user.createdAt,
    ...(roles ? { roles } : {}),
    ...(primaryRole ? { roleId: primaryRole.id, roleName: primaryRole.name } : {}),
    ...(user.updatedAt ? { updatedAt: user.updatedAt } : {}),
  };
}

// Ensures the fallback read-only user role exists and has baseline permissions.
export async function ensureDefaultUserRole() {
  const role = await prisma.role.upsert({
    where: { name: DEFAULT_ROLE_NAME },
    update: { description: DEFAULT_ROLE_DESCRIPTION },
    create: { name: DEFAULT_ROLE_NAME, description: DEFAULT_ROLE_DESCRIPTION },
    select: { id: true, name: true },
  });

  const permissions = await Promise.all(
    DEFAULT_ROLE_PERMISSION_KEYS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
        select: { id: true, key: true },
      })
    )
  );

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  return role;
}
