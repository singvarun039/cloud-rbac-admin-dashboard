import { prisma } from "../db/prisma";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import { utcDayRangeWindow } from "../utils/dateWindow";

type AggregateRow = {
  label: string | null;
  count: number;
};

type RecentFailureRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type AuditInsightsResult = {
  windowDays: number;
  answer: string;
  analytics: {
    totalEvents: number;
    totalFailures: number;
    peakDay: { date: string; count: number } | null;
    latestDay: { date: string; count: number } | null;
    topActions: Array<{ action: string; count: number }>;
    topActors: Array<{ actor: string; count: number }>;
    recentFailures: RecentFailureRow[];
  };
};

type AuditInsightsContext = {
  windowDays: number;
  trend: Array<{ date: string; count: number }>;
  totalEvents: number;
  totalFailures: number;
  peakDay: { date: string; count: number } | null;
  latestDay: { date: string; count: number } | null;
  latestVsBaseline: {
    latestCount: number;
    priorAverage: number;
  } | null;
  topActions: Array<{ action: string; count: number }>;
  topActors: Array<{ actor: string; count: number }>;
  recentFailures: RecentFailureRow[];
};

type OpenAITextContent = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAITextContent[];
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks =
    payload.output
      ?.flatMap((item) =>
        item.type === "message"
          ? (item.content ?? [])
              .filter(
                (content): content is OpenAITextContent =>
                  content.type === "output_text" &&
                  typeof content.text === "string",
              )
              .map((content) => content.text ?? "")
          : [],
      )
      .filter((text) => text.trim().length > 0) ?? [];

  return chunks.join("\n").trim();
}

function buildAuditInsightsInstructions(): string {
  return [
    "You are an audit anomaly analyst for an RBAC admin dashboard.",
    "Use only the supplied audit analytics and safe operational reasoning.",
    "Do not invent missing evidence.",
    "Keep the output concise and directly useful to an admin.",
    "Return plain text in this exact format:",
    "Summary: <one short paragraph>",
    "Anomalies:",
    "- <bullet 1>",
    "- <bullet 2>",
    "- <bullet 3 or 'No clear anomaly beyond normal variation.'>",
    "Recommendations:",
    "- <bullet 1>",
    "- <bullet 2>",
    "- <bullet 3>",
  ].join("\n");
}

function buildAuditInsightsInput(context: AuditInsightsContext): string {
  return [
    `Audit window: last ${context.windowDays} days`,
    "",
    "Audit analytics JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Loads audit-only analytics for anomaly analysis.
export async function getAuditInsightsAnalytics(windowDays: number) {
  const { start, endExclusive, dates } = utcDayRangeWindow(windowDays);

  const [trendRows, topActionRows, topActorRows, recentFailureRows, totalEvents] =
    await Promise.all([
      prisma.$queryRaw<Array<{ date: string; count: number }>>`
        SELECT
          to_char(date_trunc('day', "createdAt") AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          CAST(count(*) AS int) AS count
        FROM "AuditLog"
        WHERE "createdAt" >= ${start} AND "createdAt" < ${endExclusive}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<Array<AggregateRow>>`
        SELECT "action" AS label, CAST(count(*) AS int) AS count
        FROM "AuditLog"
        WHERE "createdAt" >= ${start} AND "createdAt" < ${endExclusive}
        GROUP BY "action"
        ORDER BY count DESC, label ASC
        LIMIT 5
      `,
      prisma.$queryRaw<Array<AggregateRow>>`
        SELECT COALESCE(u.email, a."actorUserId", 'unknown') AS label, CAST(count(*) AS int) AS count
        FROM "AuditLog" a
        LEFT JOIN "User" u ON u.id = a."actorUserId"
        WHERE a."createdAt" >= ${start} AND a."createdAt" < ${endExclusive}
        GROUP BY COALESCE(u.email, a."actorUserId", 'unknown')
        ORDER BY count DESC, label ASC
        LIMIT 5
      `,
      prisma.$queryRaw<Array<RecentFailureRow>>`
        SELECT
          a.id,
          a.action,
          a."entityType",
          a."entityId",
          a."actorUserId",
          u.email AS "actorEmail",
          to_char(a."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
        FROM "AuditLog" a
        LEFT JOIN "User" u ON u.id = a."actorUserId"
        WHERE a."createdAt" >= ${start}
          AND a."createdAt" < ${endExclusive}
          AND a.action LIKE '%FAILURE%'
        ORDER BY a."createdAt" DESC
        LIMIT 8
      `,
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: start,
            lt: endExclusive,
          },
        },
      }),
    ]);

  const trendByDate = new Map<string, number>();
  for (const row of trendRows) {
    trendByDate.set(row.date, Number(row.count) || 0);
  }

  const trend = dates.map((date) => ({
    date,
    count: trendByDate.get(date) ?? 0,
  }));

  const totalFailures = recentFailureRows.length
    ? await prisma.auditLog.count({
        where: {
          createdAt: {
            gte: start,
            lt: endExclusive,
          },
          action: {
            contains: "FAILURE",
          },
        },
      })
    : 0;

  const topActions = topActionRows.map((row) => ({
    action: row.label ?? "unknown",
    count: Number(row.count) || 0,
  }));

  const topActors = topActorRows.map((row) => ({
    actor: row.label ?? "unknown",
    count: Number(row.count) || 0,
  }));

  const peakDay =
    trend.length > 0
      ? trend.reduce((best, day) => (day.count > best.count ? day : best), trend[0])
      : null;

  const latestDay = trend.length > 0 ? trend[trend.length - 1] : null;
  const priorDays = trend.slice(0, -1).map((day) => day.count);
  const latestVsBaseline = latestDay
    ? {
        latestCount: latestDay.count,
        priorAverage: Number(average(priorDays).toFixed(2)),
      }
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

// Generates anomaly-focused audit insights from aggregated audit activity.
export async function generateAuditInsights(
  windowDays: number,
): Promise<AuditInsightsResult> {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "AI assistant is not configured yet. Add OPENAI_API_KEY to enable it.",
    );
  }

  const analytics = await getAuditInsightsAnalytics(windowDays);

  let response: Response;
  try {
    response = await fetch(`${env.OPENAI_API_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        instructions: buildAuditInsightsInstructions(),
        input: buildAuditInsightsInput({
          windowDays,
          trend: analytics.trend,
          totalEvents: analytics.totalEvents,
          totalFailures: analytics.totalFailures,
          peakDay: analytics.peakDay,
          latestDay: analytics.latestDay,
          latestVsBaseline: analytics.latestVsBaseline,
          topActions: analytics.topActions,
          topActors: analytics.topActors,
          recentFailures: analytics.recentFailures,
        }),
        max_output_tokens: 500,
        temperature: 0.2,
      }),
    });
  } catch {
    throw new AppError(
      502,
      "AI_UPSTREAM_ERROR",
      "The AI provider could not be reached. Please try again.",
    );
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new AppError(
      502,
      "AI_UPSTREAM_ERROR",
      "The AI provider returned an error.",
      details || undefined,
    );
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const answer = extractOutputText(payload);
  if (!answer) {
    throw new AppError(
      502,
      "AI_EMPTY_RESPONSE",
      "The AI provider returned an empty response.",
    );
  }

  return {
    windowDays,
    answer,
    analytics: {
      totalEvents: analytics.totalEvents,
      totalFailures: analytics.totalFailures,
      peakDay: analytics.peakDay,
      latestDay: analytics.latestDay,
      topActions: analytics.topActions,
      topActors: analytics.topActors,
      recentFailures: analytics.recentFailures,
    },
  };
}
