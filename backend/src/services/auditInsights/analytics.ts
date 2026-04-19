import { prisma } from '../../db/prisma';
import { utcDayRangeWindow } from '../../utils/dateWindow';

type AggregateRow = { label: string | null; count: number };

type RecentFailureRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Loads audit-only analytics for anomaly analysis.
export async function getAuditInsightsAnalytics(windowDays: number) {
  const { start, endExclusive, dates } = utcDayRangeWindow(windowDays);

  const [trendRows, topActionRows, topActorRows, recentFailureRows, totalEvents] =
    await Promise.all([
      prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT to_char(date_trunc('day', "createdAt") AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, CAST(count(*) AS int) AS count
      FROM "AuditLog"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${endExclusive}
      GROUP BY 1 ORDER BY 1 ASC
    `,
      prisma.$queryRaw<Array<AggregateRow>>`
      SELECT "action" AS label, CAST(count(*) AS int) AS count
      FROM "AuditLog"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${endExclusive}
      GROUP BY "action" ORDER BY count DESC, label ASC LIMIT 5
    `,
      prisma.$queryRaw<Array<AggregateRow>>`
      SELECT COALESCE(u.email, a."actorUserId", 'unknown') AS label, CAST(count(*) AS int) AS count
      FROM "AuditLog" a
      LEFT JOIN "User" u ON u.id = a."actorUserId"
      WHERE a."createdAt" >= ${start} AND a."createdAt" < ${endExclusive}
      GROUP BY COALESCE(u.email, a."actorUserId", 'unknown')
      ORDER BY count DESC, label ASC LIMIT 5
    `,
      prisma.$queryRaw<Array<RecentFailureRow>>`
      SELECT a.id, a.action, a."entityType", a."entityId", a."actorUserId", u.email AS "actorEmail",
        to_char(a."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
      FROM "AuditLog" a
      LEFT JOIN "User" u ON u.id = a."actorUserId"
      WHERE a."createdAt" >= ${start} AND a."createdAt" < ${endExclusive} AND a.action LIKE '%FAILURE%'
      ORDER BY a."createdAt" DESC LIMIT 8
    `,
      prisma.auditLog.count({ where: { createdAt: { gte: start, lt: endExclusive } } }),
    ]);

  const trendByDate = new Map<string, number>();
  for (const row of trendRows) trendByDate.set(row.date, Number(row.count) || 0);

  const trend = dates.map((date) => ({ date, count: trendByDate.get(date) ?? 0 }));

  const totalFailures = recentFailureRows.length
    ? await prisma.auditLog.count({
        where: { createdAt: { gte: start, lt: endExclusive }, action: { contains: 'FAILURE' } },
      })
    : 0;

  const topActions = topActionRows.map((r) => ({
    action: r.label ?? 'unknown',
    count: Number(r.count) || 0,
  }));
  const topActors = topActorRows.map((r) => ({
    actor: r.label ?? 'unknown',
    count: Number(r.count) || 0,
  }));
  const peakDay =
    trend.length > 0
      ? trend.reduce((best, day) => (day.count > best.count ? day : best), trend[0])
      : null;
  const latestDay = trend.length > 0 ? trend[trend.length - 1] : null;
  const priorDays = trend.slice(0, -1).map((day) => day.count);
  const latestVsBaseline = latestDay
    ? { latestCount: latestDay.count, priorAverage: Number(average(priorDays).toFixed(2)) }
    : null;

  return {
    windowDays,
    trend,
    totalEvents,
    totalFailures,
    topActions,
    topActors,
    recentFailures: recentFailureRows,
    peakDay,
    latestDay,
    latestVsBaseline,
  };
}
