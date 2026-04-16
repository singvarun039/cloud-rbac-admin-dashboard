import { prisma } from "../db/prisma";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";

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

type AccessSurface = {
  kind: "page" | "api";
  key: string;
  label: string;
  description: string;
  requiredAnyOf: string[];
};

type SurfaceImpact = {
  kind: "page" | "api";
  key: string;
  label: string;
  description: string;
  requiredAnyOf: string[];
};

export type PolicySimulationResult = {
  role: {
    id: string;
    name: string;
    description: string | null;
  };
  currentPermissionKeys: string[];
  proposedPermissionKeys: string[];
  addedPermissionKeys: string[];
  removedPermissionKeys: string[];
  impacts: {
    losingAccess: SurfaceImpact[];
    gainingAccess: SurfaceImpact[];
    unchangedAccessible: SurfaceImpact[];
  };
  summary: string;
};

const APP_ACCESS_SURFACES: AccessSurface[] = [
  {
    kind: "page",
    key: "page.users",
    label: "Users page",
    description: "View the users management screen.",
    requiredAnyOf: ["users.read"],
  },
  {
    kind: "page",
    key: "page.roles",
    label: "Roles page",
    description: "View the roles management screen.",
    requiredAnyOf: ["roles.read"],
  },
  {
    kind: "page",
    key: "page.projects",
    label: "Projects page",
    description: "View the projects screen.",
    requiredAnyOf: ["projects.read"],
  },
  {
    kind: "page",
    key: "page.auditLogs",
    label: "Audit Logs page",
    description: "View the audit logs screen.",
    requiredAnyOf: ["audit.read"],
  },
  {
    kind: "api",
    key: "api.users.list",
    label: "List users",
    description: "Read the users API listing.",
    requiredAnyOf: ["users.read"],
  },
  {
    kind: "api",
    key: "api.users.create",
    label: "Create users",
    description: "Create new users through the API.",
    requiredAnyOf: ["users.write"],
  },
  {
    kind: "api",
    key: "api.users.edit",
    label: "Edit users",
    description: "Update existing users through the API.",
    requiredAnyOf: ["users.write", "users.edit"],
  },
  {
    kind: "api",
    key: "api.roles.list",
    label: "List roles",
    description: "Read the roles API listing.",
    requiredAnyOf: ["roles.read"],
  },
  {
    kind: "api",
    key: "api.roles.create",
    label: "Create roles",
    description: "Create new roles through the API.",
    requiredAnyOf: ["roles.write"],
  },
  {
    kind: "api",
    key: "api.roles.edit",
    label: "Edit roles",
    description: "Update role metadata through the API.",
    requiredAnyOf: ["roles.write", "roles.edit"],
  },
  {
    kind: "api",
    key: "api.roles.permissions",
    label: "Update role permissions",
    description: "Change permission assignments on roles.",
    requiredAnyOf: ["roles.write", "roles.edit"],
  },
  {
    kind: "api",
    key: "api.projects.list",
    label: "List projects",
    description: "Read the projects API listing.",
    requiredAnyOf: ["projects.read"],
  },
  {
    kind: "api",
    key: "api.projects.create",
    label: "Create projects",
    description: "Create new projects through the API.",
    requiredAnyOf: ["projects.write"],
  },
  {
    kind: "api",
    key: "api.projects.edit",
    label: "Edit projects",
    description: "Update projects through the API.",
    requiredAnyOf: ["projects.write", "projects.edit"],
  },
  {
    kind: "api",
    key: "api.permissions.list",
    label: "List permissions",
    description: "Read the permissions catalog.",
    requiredAnyOf: ["permissions.read"],
  },
  {
    kind: "api",
    key: "api.audit.list",
    label: "Read audit logs",
    description: "Read audit log records.",
    requiredAnyOf: ["audit.read"],
  },
];

function hasAnyPermission(
  permissionKeys: Set<string>,
  requiredAnyOf: string[],
): boolean {
  return requiredAnyOf.some((key) => permissionKeys.has(key));
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

function buildFallbackSummary(input: {
  roleName: string;
  removedPermissionKeys: string[];
  addedPermissionKeys: string[];
  losingAccess: SurfaceImpact[];
  gainingAccess: SurfaceImpact[];
}): string {
  const lines: string[] = [];
  lines.push(
    `Simulation for role ${input.roleName}: ${input.removedPermissionKeys.length} permissions removed, ${input.addedPermissionKeys.length} added.`,
  );

  if (input.losingAccess.length > 0) {
    lines.push(
      `This role would lose access to ${input.losingAccess.length} surfaces, including ${input.losingAccess
        .slice(0, 3)
        .map((surface) => surface.label)
        .join(", ")}.`,
    );
  } else {
    lines.push("No currently accessible modeled surfaces would be lost.");
  }

  if (input.gainingAccess.length > 0) {
    lines.push(
      `The proposal would add access to ${input.gainingAccess.length} surfaces, including ${input.gainingAccess
        .slice(0, 3)
        .map((surface) => surface.label)
        .join(", ")}.`,
    );
  } else {
    lines.push("No newly accessible modeled surfaces were detected.");
  }

  return lines.join(" ");
}

async function generateSimulationSummary(input: {
  roleName: string;
  currentPermissionKeys: string[];
  proposedPermissionKeys: string[];
  removedPermissionKeys: string[];
  addedPermissionKeys: string[];
  losingAccess: SurfaceImpact[];
  gainingAccess: SurfaceImpact[];
}): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    return buildFallbackSummary(input);
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
        instructions: [
          "You are an RBAC change simulator for an admin dashboard.",
          "Use only the provided simulation results.",
          "Do not invent additional breakages.",
          "Keep the answer concise and practical.",
          "Return plain text with two short sections:",
          "Impact: <one short paragraph>",
          "Advice:",
          "- <bullet 1>",
          "- <bullet 2>",
          "- <bullet 3 or 'No major action needed.'>",
        ].join("\n"),
        input: JSON.stringify(input, null, 2),
        max_output_tokens: 350,
        temperature: 0.2,
      }),
    });
  } catch {
    return buildFallbackSummary(input);
  }

  if (!response.ok) {
    return buildFallbackSummary(input);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  return extractOutputText(payload) || buildFallbackSummary(input);
}

// Simulates the impact of replacing a role's permission set before saving it.
export async function simulateRolePolicyChange(input: {
  roleId: string;
  permissionIds?: string[];
  permissionKeys?: string[];
}): Promise<PolicySimulationResult> {
  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        select: {
          permission: {
            select: {
              id: true,
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

  if (!role) {
    throw AppError.notFound("Role not found");
  }

  let proposedPermissions: Array<{ id: string; key: string }> = [];

  if (Array.isArray(input.permissionKeys)) {
    if (input.permissionKeys.length > 0) {
      proposedPermissions = await prisma.permission.findMany({
        where: { key: { in: input.permissionKeys } },
        select: { id: true, key: true },
      });

      const foundKeys = new Set(proposedPermissions.map((item) => item.key));
      const invalidPermissionKeys = input.permissionKeys.filter(
        (key) => !foundKeys.has(key),
      );
      if (invalidPermissionKeys.length > 0) {
        throw AppError.validation({ invalidPermissionKeys });
      }
    }
  } else if (Array.isArray(input.permissionIds)) {
    if (input.permissionIds.length > 0) {
      proposedPermissions = await prisma.permission.findMany({
        where: { id: { in: input.permissionIds } },
        select: { id: true, key: true },
      });

      const foundIds = new Set(proposedPermissions.map((item) => item.id));
      const invalidPermissionIds = input.permissionIds.filter(
        (id) => !foundIds.has(id),
      );
      if (invalidPermissionIds.length > 0) {
        throw AppError.validation({ invalidPermissionIds });
      }
    }
  }

  const currentPermissionKeys = role.permissions.map((item) => item.permission.key);
  const proposedPermissionKeys = proposedPermissions
    .map((item) => item.key)
    .sort((a, b) => a.localeCompare(b));

  const currentSet = new Set(currentPermissionKeys);
  const proposedSet = new Set(proposedPermissionKeys);

  const removedPermissionKeys = currentPermissionKeys.filter(
    (key) => !proposedSet.has(key),
  );
  const addedPermissionKeys = proposedPermissionKeys.filter(
    (key) => !currentSet.has(key),
  );

  const losingAccess: SurfaceImpact[] = [];
  const gainingAccess: SurfaceImpact[] = [];
  const unchangedAccessible: SurfaceImpact[] = [];

  for (const surface of APP_ACCESS_SURFACES) {
    const currentAccess = hasAnyPermission(currentSet, surface.requiredAnyOf);
    const proposedAccess = hasAnyPermission(proposedSet, surface.requiredAnyOf);
    const shaped: SurfaceImpact = {
      kind: surface.kind,
      key: surface.key,
      label: surface.label,
      description: surface.description,
      requiredAnyOf: surface.requiredAnyOf,
    };

    if (currentAccess && !proposedAccess) losingAccess.push(shaped);
    else if (!currentAccess && proposedAccess) gainingAccess.push(shaped);
    else if (currentAccess && proposedAccess) unchangedAccessible.push(shaped);
  }

  const summary = await generateSimulationSummary({
    roleName: role.name,
    currentPermissionKeys,
    proposedPermissionKeys,
    removedPermissionKeys,
    addedPermissionKeys,
    losingAccess,
    gainingAccess,
  });

  return {
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
    },
    currentPermissionKeys,
    proposedPermissionKeys,
    addedPermissionKeys,
    removedPermissionKeys,
    impacts: {
      losingAccess,
      gainingAccess,
      unchangedAccessible,
    },
    summary,
  };
}
