import { prisma } from "../db/prisma";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import { utcDayRangeWindow } from "../utils/dateWindow";
import {
  extractOpenAiResponseText,
  summarizeOpenAiPayload,
} from "./openaiResponseText.service";

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

type RoleRecommendationContext = {
  windowDays: number;
  roles: RoleSnapshot[];
  overlapPairs: RoleOverlapPair[];
  rolesWithNoPermissions: string[];
  broadestRoles: Array<{ role: string; permissionCount: number }>;
  auditSignals: RoleAuditSignal[];
  roleAuditVisible: boolean;
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

function extractOutputText(payload: unknown): string {
  return extractOpenAiResponseText(payload);
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

function buildDeterministicRoleRecommendations(
  context: RoleRecommendationContext,
): string {
  const summaryParts: string[] = [
    `The role matrix currently contains ${context.roles.length} role(s) and ${new Set(context.roles.flatMap((role) => role.permissions)).size} distinct permission key(s).`,
  ];

  if (context.rolesWithNoPermissions.length > 0) {
    summaryParts.push(
      `${context.rolesWithNoPermissions.length} role(s) have no permissions assigned.`,
    );
  }

  if (context.overlapPairs.length > 0) {
    const topOverlap = context.overlapPairs[0];
    summaryParts.push(
      `The highest overlap is between ${topOverlap.roleA} and ${topOverlap.roleB} with ${topOverlap.overlapCount} shared permission(s).`,
    );
  }

  const recommendations: string[] = [];
  const risks: string[] = [];

  if (context.rolesWithNoPermissions.length > 0) {
    recommendations.push(
      `Review ${context.rolesWithNoPermissions.join(", ")} and either assign a clear responsibility set or remove unused roles.`,
    );
    risks.push(
      "Empty roles usually indicate incomplete setup or stale access design that can confuse admins.",
    );
  }

  if (context.overlapPairs.length > 0) {
    const topOverlap = context.overlapPairs[0];
    recommendations.push(
      `Compare ${topOverlap.roleA} and ${topOverlap.roleB} to confirm whether both roles are still needed as separate access boundaries.`,
    );
    risks.push(
      `High permission overlap between ${topOverlap.roleA} and ${topOverlap.roleB} may make the policy harder to maintain and review.`,
    );
  }

  if (context.broadestRoles.length > 0) {
    const broadest = context.broadestRoles[0];
    recommendations.push(
      `Validate whether ${broadest.role} still needs ${broadest.permissionCount} permissions or whether some privileges can move into a narrower role.`,
    );
    risks.push(
      `${broadest.role} currently has the broadest access footprint in the matrix.`,
    );
  }

  if (context.roleAuditVisible && context.auditSignals.length > 0) {
    const topSignal = context.auditSignals[0];
    recommendations.push(
      `Use the recent ${topSignal.action} audit activity to sanity-check whether role changes are happening in a controlled way.`,
    );
  } else if (!context.roleAuditVisible) {
    recommendations.push(
      "Audit-backed role evidence is limited for this user, so rely on the role matrix first and verify changes with an audit-enabled admin when needed.",
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "No immediate structural cleanup stands out; keep reviewing roles against real job boundaries and least-privilege expectations.",
    );
  }

  if (!risks.length) {
    risks.push("No major role design risk is obvious from current data.");
  }

  return [
    `Summary: ${summaryParts.join(" ")}`,
    "Recommendations:",
    ...recommendations.slice(0, 3).map((line) => `- ${line}`),
    "Risks:",
    ...risks.slice(0, 3).map((line) => `- ${line}`),
  ].join("\n");
}

function isUsableRoleRecommendationAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("Summary:")) return false;
  if (trimmed.includes("<one short paragraph>")) return false;
  if (trimmed.includes("<bullet 1>")) return false;
  return true;
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
  const recommendationContext: RoleRecommendationContext = {
    windowDays: input.windowDays,
    roles: roleSnapshots,
    overlapPairs,
    rolesWithNoPermissions,
    broadestRoles,
    auditSignals,
    roleAuditVisible: input.includeAuditSignals,
  };

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
          ...recommendationContext,
        }),
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
  const extractedAnswer = extractOutputText(payload);
  const answer = isUsableRoleRecommendationAnswer(extractedAnswer)
    ? extractedAnswer
    : buildDeterministicRoleRecommendations(recommendationContext);

  if (!answer) {
    throw new AppError(
      502,
      "AI_EMPTY_RESPONSE",
      "The AI provider returned an empty response.",
      summarizeOpenAiPayload(payload),
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
