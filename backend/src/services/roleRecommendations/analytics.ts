import { prisma } from '../../db/prisma';
import { utcDayRangeWindow } from '../../utils/dateWindow';

export type RoleOverlapPair = {
  roleA: string;
  roleB: string;
  sharedPermissions: string[];
  overlapCount: number;
};
export type RoleAuditSignal = { action: string; count: number };

export type RoleSnapshot = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
};

export function computeOverlapPairs(roles: RoleSnapshot[]): RoleOverlapPair[] {
  const pairs: RoleOverlapPair[] = [];
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const left = roles[i];
      const right = roles[j];
      const rightSet = new Set(right.permissions);
      const sharedPermissions = left.permissions.filter((k) => rightSet.has(k));
      if (sharedPermissions.length === 0) continue;
      pairs.push({
        roleA: left.name,
        roleB: right.name,
        sharedPermissions,
        overlapCount: sharedPermissions.length,
      });
    }
  }
  return pairs.sort((a, b) => b.overlapCount - a.overlapCount).slice(0, 5);
}

export async function getRoleAuditSignals(windowDays: number): Promise<RoleAuditSignal[]> {
  const { start, endExclusive } = utcDayRangeWindow(windowDays);
  const rows = await prisma.$queryRaw<Array<{ action: string; count: number }>>`
    SELECT a.action, CAST(count(*) AS int) AS count
    FROM "AuditLog" a
    WHERE a."createdAt" >= ${start} AND a."createdAt" < ${endExclusive}
      AND (a."entityType" = 'ROLE' OR a.action IN ('ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_ASSIGNED', 'ROLE_PERMISSION_UPDATED', 'ROLE_DELETED'))
    GROUP BY a.action ORDER BY count DESC, a.action ASC LIMIT 8
  `;
  return rows.map((r) => ({ action: r.action, count: Number(r.count) || 0 }));
}

export async function getRoleSnapshots() {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        select: { permission: { select: { key: true } } },
        orderBy: { permission: { key: 'asc' } },
      },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: r.permissions.map((p) => p.permission.key),
  }));
}
