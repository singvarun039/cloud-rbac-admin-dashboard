import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import type { DashboardSummaryResult } from "./dashboardSummary.service";
import {
  extractOpenAiResponseText,
  summarizeOpenAiPayload,
} from "./openaiResponseText.service";

type AssistantContext = {
  prompt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    permissions: string[];
  };
  summary: DashboardSummaryResult;
};

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getAuditSignals(summary: DashboardSummaryResult) {
  const trend = summary.auditTrend ?? [];
  const latestDay = trend.length ? trend[trend.length - 1] : null;
  const priorAverage = average(trend.slice(0, -1).map((day) => day.count));
  const recentActions = new Map<string, number>();

  for (const event of summary.recentAudit ?? []) {
    recentActions.set(event.action, (recentActions.get(event.action) ?? 0) + 1);
  }

  const topRecentAction =
    [...recentActions.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => ({ action, count }))[0] ?? null;

  return {
    latestDay,
    priorAverage,
    topRecentAction,
  };
}

function buildDeterministicAssistantReply(context: AssistantContext): string {
  const lowerPrompt = context.prompt.toLowerCase();
  const { kpis, recentAudit } = context.summary;
  const { latestDay, priorAverage, topRecentAction } = getAuditSignals(
    context.summary,
  );
  const lines: string[] = [];

  if (lowerPrompt.includes("risk") || lowerPrompt.includes("anomal")) {
    lines.push("Observations:");

    if (
      latestDay &&
      latestDay.count >= 4 &&
      latestDay.count > Math.max(priorAverage * 2, 1)
    ) {
      lines.push(
        `- Audit activity spiked on ${latestDay.date} to ${latestDay.count} events versus a prior average of ${priorAverage.toFixed(1)}.`,
      );
    } else {
      lines.push("- No strong anomaly is visible in the current audit trend alone.");
    }

    if (topRecentAction?.action === "AI_FEATURE_USED") {
      lines.push(
        "- Recent activity is heavily skewed toward AI feature usage, so the current signal set is narrow.",
      );
    }

    if (!recentAudit.length) {
      lines.push("- There is very little recent audit activity available to compare against a normal baseline.");
    }

    lines.push("Recommendations:");
    lines.push(
      "- Check whether the spike came from expected testing or admin review activity before treating it as suspicious.",
    );
    lines.push(
      "- Revisit the dashboard after more non-AI admin actions accumulate so anomaly detection has a better baseline.",
    );

    return lines.join("\n");
  }

  if (
    lowerPrompt.includes("priorit") ||
    lowerPrompt.includes("improvement") ||
    lowerPrompt.includes("next step")
  ) {
    lines.push("Observations:");
    lines.push(
      `- The dashboard currently shows ${kpis.usersTotal ?? "unknown"} users, ${kpis.rolesTotal ?? "unknown"} roles, and ${kpis.projectsTotal ?? "unknown"} projects.`,
    );
    lines.push(
      `- The ${kpis.auditTotalWindow ?? 0}-event audit window is currently dominated by recent operational checks rather than broad day-to-day usage.`,
    );
    lines.push("Recommendations:");
    lines.push("- Review role design on the Roles page and confirm each role still maps cleanly to real job boundaries.");
    lines.push("- Validate that sensitive actions are audited consistently so future AI insights can use richer signals.");
    lines.push("- If the current spike was test activity, separate testing from production-like admin usage where possible.");

    return lines.join("\n");
  }

  lines.push("Observations:");
  lines.push(
    `- The dashboard shows ${kpis.usersTotal ?? "unknown"} users, ${kpis.rolesTotal ?? "unknown"} roles, ${kpis.projectsTotal ?? "unknown"} projects, and ${kpis.auditTotalWindow ?? "unknown"} audit events in the last 14 days.`,
  );

  if (latestDay) {
    lines.push(`- The latest audit day is ${latestDay.date} with ${latestDay.count} recorded events.`);
  }

  if (topRecentAction) {
    lines.push(`- The most frequent recent action is ${topRecentAction.action} (${topRecentAction.count} in the latest activity list).`);
  }

  lines.push("Recommendations:");
  lines.push("- Use the Roles page AI recommendations and policy simulation to review any broad or risky access patterns.");
  lines.push("- Keep monitoring audit activity as more varied operational events accumulate.");

  return lines.join("\n");
}

function isUsableAssistantAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  if (trimmed.includes("<bullet")) return false;
  if (trimmed.includes("<one short paragraph>")) return false;
  return true;
}

function getAssistantInstructions(context: AssistantContext): string {
  return [
    "You are the RBAC AI assistant for an internal admin dashboard.",
    "Answer only using the provided application context and generally safe RBAC best practices.",
    "Do not invent database rows, users, roles, or permissions that are not in the context.",
    "If the user asks for information the context does not contain, say what is missing.",
    "Keep answers concise and practical.",
    "Prefer bullet points when listing recommendations.",
    "When suggesting changes, clearly separate observations from recommendations.",
    `Signed-in user: ${context.user.name ?? "Unknown"} <${context.user.email}>.`,
    `Visible permissions: ${context.user.permissions.join(", ") || "none"}.`,
  ].join("\n");
}

function getAssistantInput(context: AssistantContext): string {
  const summary = {
    kpis: context.summary.kpis,
    recentAudit: context.summary.recentAudit,
  };

  return [
    "User question:",
    context.prompt,
    "",
    "Current dashboard context JSON:",
    JSON.stringify(summary, null, 2),
  ].join("\n");
}

// Calls the OpenAI Responses API to answer an RBAC-focused dashboard question.
export async function generateAdminAssistantReply(
  context: AssistantContext,
): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "AI assistant is not configured yet. Add OPENAI_API_KEY to enable it.",
    );
  }

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
        instructions: getAssistantInstructions(context),
        input: getAssistantInput(context),
        max_output_tokens: 700,
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

  const payload = (await response.json()) as unknown;
  const extractedAnswer = extractOpenAiResponseText(payload);
  const answer = isUsableAssistantAnswer(extractedAnswer)
    ? extractedAnswer
    : buildDeterministicAssistantReply(context);

  if (!answer) {
    throw new AppError(
      502,
      "AI_EMPTY_RESPONSE",
      "The AI provider returned an empty response.",
      summarizeOpenAiPayload(payload),
    );
  }

  return answer;
}
