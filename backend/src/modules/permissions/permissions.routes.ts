import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { ok } from "../../utils/apiResponse";

export const permissionsRouter = Router();

permissionsRouter.get(
  "/",
  authenticate,
  requirePermission("permissions.read"),
  asyncHandler(async (req, res) => {
    const permissions = await prisma.permission.findMany({
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        description: true,
        createdAt: true,
      },
    });

    return ok(res, req, { permissions }, 200);
  }),
);
