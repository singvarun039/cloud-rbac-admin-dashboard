import { AppError } from "../../errors/AppError";
import { env } from "../../config/env";
import { extractOpenAiResponseText, summarizeOpenAiPayload } from "../openaiResponseText.service";
import { getAuditInsightsAnalytics } from "./analytics";
import { buildDeterministicAuditInsights, isUsableAuditInsightsAnswer, buildAuditInsightsInstructions } from "./deterministic";

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
    recentFailures: unknown[];
  };
};

// Generates anomaly-focused audit insights from aggregated audit activity.
export async function generateAuditInsights(windowDays: number): Promise<AuditInsightsResult> {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(503, "AI_NOT_CONFIGURED", "AI assistant is not configured yet. Add OPENAI_API_KEY to enable it.");
  }

  const analytics = await getAuditInsightsAnalytics(windowDays);

  const insightsInput = [
    `Audit window: last ${windowDays} days`,
    "",
    "Audit analytics JSON:",
    JSON.stringify({ windowDays, trend: analytics.trend, totalEvents: analytics.totalEvents, totalFailures: analytics.totalFailures, peakDay: analytics.peakDay, latestDay: analytics.latestDay, latestVsBaseline: analytics.latestVsBaseline, topActions: analytics.topActions, topActors: analytics.topActors, recentFailures: analytics.recentFailures }, null, 2),
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(`${env.OPENAI_API_BASE_URL}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_MODEL, instructions: buildAuditInsightsInstructions(), input: insightsInput, max_output_tokens: 500 }),
    });
  } catch {
    throw new AppError(502, "AI_UPSTREAM_ERROR", "The AI provider could not be reached. Please try again.");
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new AppError(502, "AI_UPSTREAM_ERROR", "The AI provider returned an error.", details || undefined);
  }

  const payload = (await response.json()) as unknown;
  const extractedAnswer = extractOpenAiResponseText(payload);
  const answer = isUsableAuditInsightsAnswer(extractedAnswer)
    ? extractedAnswer
    : buildDeterministicAuditInsights({ windowDays, trend: analytics.trend, totalEvents: analytics.totalEvents, totalFailures: analytics.totalFailures, peakDay: analytics.peakDay, latestDay: analytics.latestDay, latestVsBaseline: analytics.latestVsBaseline, topActions: analytics.topActions, topActors: analytics.topActors, recentFailures: analytics.recentFailures });

  if (!answer) {
    throw new AppError(502, "AI_EMPTY_RESPONSE", "The AI provider returned an empty response.", summarizeOpenAiPayload(payload));
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
