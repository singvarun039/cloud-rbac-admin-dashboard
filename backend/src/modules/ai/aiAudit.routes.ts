import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { ok } from "../../utils/apiResponse";
import { AppError } from "../../errors/AppError";
import { generateAuditInsights } from "../../services/auditInsights";
import { DashboardSummaryQuerySchema } from "../../validation/dashboard.schema";
import {
  AI_DATA_SOURCES,
  aiRateLimiter,
  writeAiUsageAuditLog,
} from "../../services/aiGovernance.service";

export const aiAuditRouter = Router();

aiAuditRouter.get(
  "/audit-insights",
  authenticate,
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const perms = new Set(req.user?.permissions ?? []);
    if (!perms.has("audit.read")) {
      throw AppError.forbidden(
        "You need audit.read permission to access audit insights.",
      );
    }

    const parsed = DashboardSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "BAD_REQUEST", "Bad request", {
        issues: parsed.error.issues,
      });
    }

    const insights = await generateAuditInsights(parsed.data.windowDays);
    const sources = [AI_DATA_SOURCES.auditAggregates];

    await writeAiUsageAuditLog({
      req,
      feature: "audit-insights",
      model: "openai",
      dataSources: sources,
      meta: {
        windowDays: parsed.data.windowDays,
      },
    });

    return ok(res, req, { ...insights, sources }, 200);
  }),
);
