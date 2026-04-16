import { prisma } from "../db/prisma";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import { utcDayRangeWindow } from "../utils/dateWindow";

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

type RoleSnapshot = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
};

type RoleOverlapPair = {
  roleA: string;
  roleB: string;
  sharedPermissions: string[];
  overlapCount: number;
};

type RoleAuditSignal = {
  action: string;
  count: number;
};

export type RoleRecommendationsResult = {
  windowDays: number;
  answer: string;
  analytics: {
    totalRoles: number;
    totalDistinctPermissions: number;
    rolesWithNoPermissions: string[];
    broadestRoles: Array<{ role: string; permissionCount: number }>;
    overlapPairs: RoleOverlapPair[];
    auditSignals: RoleAuditSignal[];
    roleAuditVisible: boolean;
  };
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

function buildRoleRecommendationInstructions(input: {
  roleAuditVisible: boolean;
}): string {
  return [
    "You are an RBAC policy reviewer for an admin dashboard.",
    "Use only the supplied role matrix and audit signals.",
    "Do not invent users, permissions, or incidents.",
    "Favor least privilege, clarity, and maintainability.",
    input.roleAuditVisible
      ? "Audit behavior is available. Use it when it strengthens the recommendation."
      : "Audit behavior is not available to this caller. Do not claim audit-backed evidence.",
    "Keep the output concise and actionable.",
    "Return plain text in this exact format:",
    "Summary: <one short paragraph>",
    "Recommendations:",
    "- <bullet 1>",
    "- <bullet 2>",
    "- <bullet 3>",
    "Risks:",
    "- <bullet 1>",
    "- <bullet 2>",
    "- <bullet 3 or 'No major role design risk is obvious from current data.'>",
  ].join("\n");
}

function buildRoleRecommendationInput(input: {
  windowDays: number;
  roles: RoleSnapshot[];
  overlapPairs: RoleOverlapPair[];
  rolesWithNoPermissions: string[];
  broadestRoles: Array<{ role: string; permissionCount: number }>;
  auditSignals: RoleAuditSignal[];
  roleAuditVisible: boolean;
}): string {
  return [
    `Audit window for role behavior: last ${input.windowDays} days`,
    "",
    "Role recommendation context JSON:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

function computeOverlapPairs(roles: RoleSnapshot[]): RoleOverlapPair[] {
  const pairs: RoleOverlapPair[] = [];

  for (let i = 0; i < roles.length; i += 1) {
    for (let j = i + 1; j < roles.length; j += 1) {
      const left = roles[i];
      const right = roles[j];
      const rightSet = new Set(right.permissions);
      const sharedPermissions = left.permissions.filter((key) =>
        rightSet.has(key),
      );

      if (sharedPermissions.length === 0) continue;

      pairs.push({
        roleA: left.name,
        roleB: right.name,
        sharedPermissions,
        overlapCount: sharedPermissions.length,
      });
    }
  }

  return pairs
    .sort((a, b) => b.overlapCount - a.overlapCount)
    .slice(0, 5);
}

async function getRoleAuditSignals(windowDays: number) {
  const { start, endExclusive } = utcDayRangeWindow(windowDays);

  const rows = await prisma.$queryRaw<Array<{ action: string; count: number }>>`
    SELECT a.action, CAST(count(*) AS int) AS count
    FROM "AuditLog" a
    WHERE a."createdAt" >= ${start}
      AND a."createdAt" < ${endExclusive}
      AND (
        a."entityType" = 'ROLE'
        OR a.action IN ('ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_ASSIGNED', 'ROLE_PERMISSION_UPDATED', 'ROLE_DELETED')
      )
    GROUP BY a.action
    ORDER BY count DESC, a.action ASC
    LIMIT 8
  `;

  return rows.map((row) => ({
    action: row.action,
    count: Number(row.count) || 0,
  }));
}

// Builds AI-backed role and permission recommendations from current role data.
export async function generateRoleRecommendations(input: {
  windowDays: number;
  includeAuditSignals: boolean;
}): Promise<RoleRecommendationsResult> {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "AI assistant is not configured yet. Add OPENAI_API_KEY to enable it.",
    );
  }

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        select: {
          permission: {
            select: {
              key: true,
            },
          },
        },
        orderBy: {
          permission: {
            key: "asc",
          },
        },
      },
    },
  });

  const roleSnapshots: RoleSnapshot[] = roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((item) => item.permission.key),
  }));

  const distinctPermissions = new Set(
    roleSnapshots.flatMap((role) => role.permissions),
  );

  const rolesWithNoPermissions = roleSnapshots
    .filter((role) => role.permissions.length === 0)
    .map((role) => role.name);

  const broadestRoles = [...roleSnapshots]
    .sort((a, b) => b.permissions.length - a.permissions.length)
    .slice(0, 5)
    .map((role) => ({
      role: role.name,
      permissionCount: role.permissions.length,
    }));

  const overlapPairs = computeOverlapPairs(roleSnapshots);
  const auditSignals = input.includeAuditSignals
    ? await getRoleAuditSignals(input.windowDays)
    : [];

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
        instructions: buildRoleRecommendationInstructions({
          roleAuditVisible: input.includeAuditSignals,
        }),
        input: buildRoleRecommendationInput({
          windowDays: input.windowDays,
          roles: roleSnapshots,
          overlapPairs,
          rolesWithNoPermissions,
          broadestRoles,
          auditSignals,
          roleAuditVisible: input.includeAuditSignals,
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
    windowDays: input.windowDays,
    answer,
    analytics: {
      totalRoles: roleSnapshots.length,
      totalDistinctPermissions: distinctPermissions.size,
      rolesWithNoPermissions,
      broadestRoles,
      overlapPairs,
      auditSignals,
      roleAuditVisible: input.includeAuditSignals,
    },
  };
}
