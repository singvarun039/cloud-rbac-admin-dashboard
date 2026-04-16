import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateBody } from "../../middlewares/validate";
import { ok } from "../../utils/apiResponse";
import { requirePermission } from "../../middlewares/requirePermission";
import { PolicySimulationBodySchema } from "../../validation/policySimulation.schema";
import { simulateRolePolicyChange } from "../../services/policySimulation.service";
import {
  AI_DATA_SOURCES,
  aiRateLimiter,
  writeAiUsageAuditLog,
} from "../../services/aiGovernance.service";

export const aiPolicyRouter = Router();

aiPolicyRouter.post(
  "/policy-simulation",
  authenticate,
  aiRateLimiter,
  requirePermission(["roles.write", "roles.edit"]),
  validateBody(PolicySimulationBodySchema),
  asyncHandler(async (req, res) => {
    const result = await simulateRolePolicyChange(req.body);
    const sources = [
      AI_DATA_SOURCES.roleMatrix,
      AI_DATA_SOURCES.policySurfaceMap,
      AI_DATA_SOURCES.proposedPermissionDraft,
    ];

    await writeAiUsageAuditLog({
      req,
      feature: "policy-simulation",
      model: "openai",
      dataSources: sources,
      entityId: typeof req.body.roleId === "string" ? req.body.roleId : null,
      meta: {
        proposedPermissionCount: Array.isArray(req.body.permissionIds)
          ? req.body.permissionIds.length
          : Array.isArray(req.body.permissionKeys)
            ? req.body.permissionKeys.length
            : 0,
      },
    });

    return ok(res, req, { ...result, sources }, 200);
  }),
);
