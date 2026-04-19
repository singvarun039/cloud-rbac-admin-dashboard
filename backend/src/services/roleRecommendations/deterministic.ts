import type { RoleSnapshot, RoleOverlapPair, RoleAuditSignal } from "./analytics";

export type RoleRecommendationContext = {
  windowDays: number;
  roles: RoleSnapshot[];
  overlapPairs: RoleOverlapPair[];
  rolesWithNoPermissions: string[];
  broadestRoles: Array<{ role: string; permissionCount: number }>;
  auditSignals: RoleAuditSignal[];
  roleAuditVisible: boolean;
};

export function buildRoleRecommendationInstructions(input: { roleAuditVisible: boolean }): string {
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

export function buildDeterministicRoleRecommendations(context: RoleRecommendationContext): string {
  const summaryParts: string[] = [
    `The role matrix currently contains ${context.roles.length} role(s) and ${new Set(context.roles.flatMap((r) => r.permissions)).size} distinct permission key(s).`,
  ];

  if (context.rolesWithNoPermissions.length > 0) summaryParts.push(`${context.rolesWithNoPermissions.length} role(s) have no permissions assigned.`);
  if (context.overlapPairs.length > 0) {
    const top = context.overlapPairs[0];
    summaryParts.push(`The highest overlap is between ${top.roleA} and ${top.roleB} with ${top.overlapCount} shared permission(s).`);
  }

  const recommendations: string[] = [];
  const risks: string[] = [];

  if (context.rolesWithNoPermissions.length > 0) {
    recommendations.push(`Review ${context.rolesWithNoPermissions.join(", ")} and either assign a clear responsibility set or remove unused roles.`);
    risks.push("Empty roles usually indicate incomplete setup or stale access design that can confuse admins.");
  }

  if (context.overlapPairs.length > 0) {
    const top = context.overlapPairs[0];
    recommendations.push(`Compare ${top.roleA} and ${top.roleB} to confirm whether both roles are still needed as separate access boundaries.`);
    risks.push(`High permission overlap between ${top.roleA} and ${top.roleB} may make the policy harder to maintain and review.`);
  }

  if (context.broadestRoles.length > 0) {
    const broadest = context.broadestRoles[0];
    recommendations.push(`Validate whether ${broadest.role} still needs ${broadest.permissionCount} permissions or whether some privileges can move into a narrower role.`);
    risks.push(`${broadest.role} currently has the broadest access footprint in the matrix.`);
  }

  if (context.roleAuditVisible && context.auditSignals.length > 0) {
    recommendations.push(`Use the recent ${context.auditSignals[0].action} audit activity to sanity-check whether role changes are happening in a controlled way.`);
  } else if (!context.roleAuditVisible) {
    recommendations.push("Audit-backed role evidence is limited for this user, so rely on the role matrix first and verify changes with an audit-enabled admin when needed.");
  }

  if (!recommendations.length) recommendations.push("No immediate structural cleanup stands out; keep reviewing roles against real job boundaries and least-privilege expectations.");
  if (!risks.length) risks.push("No major role design risk is obvious from current data.");

  return [
    `Summary: ${summaryParts.join(" ")}`,
    "Recommendations:",
    ...recommendations.slice(0, 3).map((l) => `- ${l}`),
    "Risks:",
    ...risks.slice(0, 3).map((l) => `- ${l}`),
  ].join("\n");
}

export function isUsableRoleRecommendationAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("Summary:")) return false;
  if (trimmed.includes("<one short paragraph>")) return false;
  if (trimmed.includes("<bullet 1>")) return false;
  return true;
}
