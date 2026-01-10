import { prisma } from "../db/prisma";

export async function fetchUserWithRolesAndPermissions(params: {
  userId?: string;
  email?: string;
}) {
  const { userId, email } = params;

  if (!userId && !email) {
    throw new Error(
      "fetchUserWithRolesAndPermissions requires userId or email"
    );
  }

  return prisma.user.findFirst({
    where: {
      ...(userId ? { id: userId } : {}),
      ...(email ? { email } : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      roles: {
        select: {
          createdAt: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: {
                  createdAt: true,
                  permission: {
                    select: {
                      id: true,
                      key: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export function computeEffectivePermissionKeys(user: {
  roles: Array<{
    role: {
      permissions: Array<{
        permission: { key: string };
      }>;
    };
  }>;
}): string[] {
  const keys = new Set<string>();

  for (const userRole of user.roles) {
    for (const rolePermission of userRole.role.permissions) {
      keys.add(rolePermission.permission.key);
    }
  }

  return Array.from(keys).sort();
}

export async function getEffectivePermissionKeysForUser(params: {
  userId?: string;
  email?: string;
}): Promise<string[]> {
  const user = await fetchUserWithRolesAndPermissions(params);
  if (!user) return [];
  return computeEffectivePermissionKeys(user);
}
