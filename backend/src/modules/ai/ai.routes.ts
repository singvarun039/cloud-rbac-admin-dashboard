import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateBody } from "../../middlewares/validate";
import { ok } from "../../utils/apiResponse";
import { AiAssistantBodySchema } from "../../validation/ai.schema";
import { utcDayRangeWindow } from "../../utils/dateWindow";
import { getDashboardSummaryForPermissions } from "../../services/dashboardSummary.service";
import { generateAdminAssistantReply } from "../../services/aiAssistant.service";

export const aiRouter = Router();

aiRouter.post(
  "/assistant",
  authenticate,
  validateBody(AiAssistantBodySchema),
  asyncHandler(async (req, res) => {
    const { start, endExclusive, dates } = utcDayRangeWindow(14);
    const summary = await getDashboardSummaryForPermissions({
      permissions: req.user?.permissions ?? [],
      start,
      endExclusive,
      dates,
    });

    const answer = await generateAdminAssistantReply({
      prompt: req.body.prompt,
      user: {
        id: req.user?.id ?? "",
        email: req.user?.email ?? "",
        name: req.user?.name ?? null,
        permissions: req.user?.permissions ?? [],
      },
      summary,
    });

    return ok(
      res,
      req,
      {
        answer,
        model: "openai",
      },
      200,
    );
  }),
);
