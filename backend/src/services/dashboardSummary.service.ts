import { prisma } from "../db/prisma";

type DashboardPermissionSet = {
  canUsers: boolean;
  canRoles: boolean;
  canProjects: boolean;
  canAudit: boolean;
};

export type DashboardSummaryResult = {
  kpis: {
    usersTotal: number | null;
    rolesTotal: number | null;
    projectsTotal: number | null;
    auditTotalWindow: number | null;
  };
  auditTrend: Array<{ date: string; count: number }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    actorUserId: string | null;
    actorEmail: string | null;
    createdAt: string;
  }>;
};

// Loads the dashboard snapshot scoped to the caller's permissions.
export async function getDashboardSummaryForPermissions(input: {
  permissions: string[];
  start: Date;
  endExclusive: Date;
  dates: string[];
}): Promise<DashboardSummaryResult> {
  const perms = new Set(input.permissions);
  const access: DashboardPermissionSet = {
    canUsers: perms.has("users.read"),
    canRoles: perms.has("roles.read"),
    canProjects: perms.has("projects.read"),
    canAudit: perms.has("audit.read"),
  };

  const [usersTotal, rolesTotal, projectsTotal] = await Promise.all([
    access.canUsers ? prisma.user.count() : Promise.resolve(null),
    access.canRoles ? prisma.role.count() : Promise.resolve(null),
    access.canProjects
      ? prisma.project.count({ where: { isArchived: false } })
      : Promise.resolve(null),
  ]);

  let auditTotalWindow: number | null = null;
  let auditTrend: Array<{ date: string; count: number }> = [];
  let recentAudit: DashboardSummaryResult["recentAudit"] = [];

  if (access.canAudit) {
    const [auditTotal, trendRows, recent] = await Promise.all([
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: input.start,
            lt: input.endExclusive,
          },
        },
      }),
      prisma.$queryRaw<Array<{ date: string; count: number }>>`
        SELECT
          to_char(date_trunc('day', "createdAt") AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          CAST(count(*) AS int) AS count
        FROM "AuditLog"
        WHERE "createdAt" >= ${input.start} AND "createdAt" < ${input.endExclusive}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          actor: { select: { email: true } },
        },
      }),
    ]);

    auditTotalWindow = auditTotal;

    const trendByDate = new Map<string, number>();
    for (const row of trendRows) {
      trendByDate.set(row.date, Number(row.count) || 0);
    }

    auditTrend = input.dates.map((date) => ({
      date,
      count: trendByDate.get(date) ?? 0,
    }));

    recentAudit = recent.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType ?? null,
      entityId: a.entityId ?? null,
      actorUserId: a.actorUserId ?? null,
      actorEmail: a.actor?.email ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  return {
    kpis: {
      usersTotal,
      rolesTotal,
      projectsTotal,
      auditTotalWindow,
    },
    auditTrend,
    recentAudit,
  };
}
