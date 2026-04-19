import { env } from '../../config/env';
import { extractOpenAiResponseText } from '../openaiResponseText.service';
import type { SurfaceImpact } from './surfaces';

function extractOutputText(payload: unknown): string {
  return extractOpenAiResponseText(payload);
}

function isUsablePolicySummary(summary: string): boolean {
  const trimmed = summary.trim();
  if (!trimmed) return false;
  if (trimmed.includes('<bullet 1>')) return false;
  if (trimmed.includes('rs_')) return false;
  if (trimmed.includes('resp_')) return false;
  return true;
}

function buildFallbackSummary(input: {
  roleName: string;
  removedPermissionKeys: string[];
  addedPermissionKeys: string[];
  losingAccess: SurfaceImpact[];
  gainingAccess: SurfaceImpact[];
}): string {
  const lines: string[] = [];
  lines.push(
    `Simulation for role ${input.roleName}: ${input.removedPermissionKeys.length} permissions removed, ${input.addedPermissionKeys.length} added.`
  );
  if (input.losingAccess.length > 0) {
    lines.push(
      `This role would lose access to ${input.losingAccess.length} surfaces, including ${input.losingAccess
        .slice(0, 3)
        .map((s) => s.label)
        .join(', ')}.`
    );
  } else {
    lines.push('No currently accessible modeled surfaces would be lost.');
  }
  if (input.gainingAccess.length > 0) {
    lines.push(
      `The proposal would add access to ${input.gainingAccess.length} surfaces, including ${input.gainingAccess
        .slice(0, 3)
        .map((s) => s.label)
        .join(', ')}.`
    );
  } else {
    lines.push('No newly accessible modeled surfaces were detected.');
  }
  return lines.join(' ');
}

export async function generateSimulationSummary(input: {
  roleName: string;
  currentPermissionKeys: string[];
  proposedPermissionKeys: string[];
  removedPermissionKeys: string[];
  addedPermissionKeys: string[];
  losingAccess: SurfaceImpact[];
  gainingAccess: SurfaceImpact[];
}): Promise<string> {
  if (!env.OPENAI_API_KEY) return buildFallbackSummary(input);

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
        instructions: [
          'You are an RBAC change simulator for an admin dashboard.',
          'Use only the provided simulation results.',
          'Do not invent additional breakages.',
          'Keep the answer concise and practical.',
          'Return plain text with two short sections:',
          'Impact: <one short paragraph>',
          'Advice:',
          '- <bullet 1>',
          '- <bullet 2>',
          "- <bullet 3 or 'No major action needed.'>",
        ].join('\n'),
        input: JSON.stringify(input, null, 2),
        max_output_tokens: 350,
      }),
    });
  } catch {
    return buildFallbackSummary(input);
  }

  if (!response.ok) return buildFallbackSummary(input);

  const payload = (await response.json()) as unknown;
  const extracted = extractOutputText(payload);
  return isUsablePolicySummary(extracted) ? extracted : buildFallbackSummary(input);
}
