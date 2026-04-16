import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateBody } from "../../middlewares/validate";
import { ok } from "../../utils/apiResponse";
import { requirePermission } from "../../middlewares/requirePermission";
import { PolicySimulationBodySchema } from "../../validation/policySimulation.schema";
import { simulateRolePolicyChange } from "../../services/policySimulation.service";

export const aiPolicyRouter = Router();

aiPolicyRouter.post(
  "/policy-simulation",
  authenticate,
  requirePermission(["roles.write", "roles.edit"]),
  validateBody(PolicySimulationBodySchema),
  asyncHandler(async (req, res) => {
    const result = await simulateRolePolicyChange(req.body);
    return ok(res, req, result, 200);
  }),
);
