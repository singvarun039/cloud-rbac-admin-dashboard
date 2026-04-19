import { AppError } from '../../errors/AppError';
import { env } from '../../config/env';
import { extractOpenAiResponseText, summarizeOpenAiPayload } from '../openaiResponseText.service';
import { getRoleSnapshots, getRoleAuditSignals, computeOverlapPairs } from './analytics';
import {
  buildRoleRecommendationInstructions,
  buildDeterministicRoleRecommendations,
  isUsableRoleRecommendationAnswer,
  type RoleRecommendationContext,
} from './deterministic';
import type { RoleOverlapPair, RoleAuditSignal } from './analytics';

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

// Builds AI-backed role and permission recommendations from current role data.
export async function generateRoleRecommendations(input: {
  windowDays: number;
  includeAuditSignals: boolean;
}): Promise<RoleRecommendationsResult> {
  if (!env.OPENAI_API_KEY) {
    throw new AppError(
      503,
      'AI_NOT_CONFIGURED',
      'AI assistant is not configured yet. Add OPENAI_API_KEY to enable it.'
    );
  }

  const roleSnapshots = await getRoleSnapshots();
  const distinctPermissions = new Set(roleSnapshots.flatMap((r) => r.permissions));
  const rolesWithNoPermissions = roleSnapshots
    .filter((r) => r.permissions.length === 0)
    .map((r) => r.name);
  const broadestRoles = [...roleSnapshots]
    .sort((a, b) => b.permissions.length - a.permissions.length)
    .slice(0, 5)
    .map((r) => ({ role: r.name, permissionCount: r.permissions.length }));
  const overlapPairs = computeOverlapPairs(roleSnapshots);
  const auditSignals = input.includeAuditSignals ? await getRoleAuditSignals(input.windowDays) : [];

  const ctx: RoleRecommendationContext = {
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        instructions: buildRoleRecommendationInstructions({
          roleAuditVisible: input.includeAuditSignals,
        }),
        input: [
          `Audit window for role behavior: last ${input.windowDays} days`,
          '',
          'Role recommendation context JSON:',
          JSON.stringify(ctx, null, 2),
        ].join('\n'),
        max_output_tokens: 700,
      }),
    });
  } catch {
    throw new AppError(
      502,
      'AI_UPSTREAM_ERROR',
      'The AI provider could not be reached. Please try again.'
    );
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new AppError(
      502,
      'AI_UPSTREAM_ERROR',
      'The AI provider returned an error.',
      details || undefined
    );
  }

  const payload = (await response.json()) as unknown;
  const extracted = extractOpenAiResponseText(payload);
  const answer = isUsableRoleRecommendationAnswer(extracted)
    ? extracted
    : buildDeterministicRoleRecommendations(ctx);

  if (!answer) {
    throw new AppError(
      502,
      'AI_EMPTY_RESPONSE',
      'The AI provider returned an empty response.',
      summarizeOpenAiPayload(payload)
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
