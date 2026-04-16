import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import type { DashboardSummaryResult } from "./dashboardSummary.service";

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

  return answer;
}
