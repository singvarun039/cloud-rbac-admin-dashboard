import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { ok } from "../../utils/apiResponse";
import { AppError } from "../../errors/AppError";
import { DashboardSummaryQuerySchema } from "../../validation/dashboard.schema";
import { generateRoleRecommendations } from "../../services/roleRecommendations.service";

export const aiRolesRouter = Router();

aiRolesRouter.get(
  "/role-recommendations",
  authenticate,
  asyncHandler(async (req, res) => {
    const perms = new Set(req.user?.permissions ?? []);
    if (!perms.has("roles.read")) {
      throw AppError.forbidden(
        "You need roles.read permission to access role recommendations.",
      );
    }

    const parsed = DashboardSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "BAD_REQUEST", "Bad request", {
        issues: parsed.error.issues,
      });
    }

    const insights = await generateRoleRecommendations({
      windowDays: parsed.data.windowDays,
      includeAuditSignals: perms.has("audit.read"),
    });

    return ok(res, req, insights, 200);
  }),
);
