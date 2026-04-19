export type AuditInsightsContext = {
  windowDays: number;
  trend: Array<{ date: string; count: number }>;
  totalEvents: number;
  totalFailures: number;
  peakDay: { date: string; count: number } | null;
  latestDay: { date: string; count: number } | null;
  latestVsBaseline: { latestCount: number; priorAverage: number } | null;
  topActions: Array<{ action: string; count: number }>;
  topActors: Array<{ actor: string; count: number }>;
  recentFailures: unknown[];
};

export function buildDeterministicAuditInsights(context: AuditInsightsContext): string {
  const topAction = context.topActions[0];
  const topActor = context.topActors[0];
  const anomalyLines: string[] = [];
  const recommendationLines: string[] = [];

  if (context.totalFailures > 0) {
    anomalyLines.push(`${context.totalFailures} failure event(s) occurred in the last ${context.windowDays} days.`);
    recommendationLines.push("Review the recent failure events first and confirm whether they were expected admin actions.");
  }

  if (context.latestVsBaseline && context.latestVsBaseline.latestCount > context.latestVsBaseline.priorAverage * 2 && context.latestVsBaseline.latestCount >= 4) {
    anomalyLines.push(`The latest day (${context.latestDay?.date ?? "latest day"}) spiked to ${context.latestVsBaseline.latestCount} events versus a prior average of ${context.latestVsBaseline.priorAverage.toFixed(1)}.`);
    recommendationLines.push("Validate whether the spike came from expected testing, admin review activity, or a permission-change burst.");
  }

  if (topAction?.action === "AI_FEATURE_USED") {
    anomalyLines.push("Most recent activity is dominated by AI feature usage rather than broader admin operations.");
    recommendationLines.push("Treat current insights as a light signal set until more varied audit activity accumulates.");
  }

  if (!anomalyLines.length) anomalyLines.push("No clear anomaly beyond normal variation.");
  if (topActor) recommendationLines.push(`Keep monitoring whether ${topActor.actor} continues to account for most dashboard activity.`);

  const summaryParts = [
    `The dashboard recorded ${context.totalEvents} audit event(s) in the last ${context.windowDays} days.`,
    context.totalFailures > 0 ? `${context.totalFailures} of those were failures.` : "No failures were recorded in this window.",
    topAction ? `The most common action was ${topAction.action} (${topAction.count}).` : null,
  ].filter(Boolean);

  return [
    `Summary: ${summaryParts.join(" ")}`,
    "Anomalies:",
    ...anomalyLines.slice(0, 3).map((l) => `- ${l}`),
    "Recommendations:",
    ...recommendationLines.slice(0, 3).map((l) => `- ${l}`),
  ].join("\n");
}

export function isUsableAuditInsightsAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("Summary:")) return false;
  if (trimmed.includes("<one short paragraph>")) return false;
  if (trimmed.includes("<bullet 1>")) return false;
  return true;
}

export function buildAuditInsightsInstructions(): string {
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
