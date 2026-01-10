import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { ok } from "../../utils/apiResponse";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateQuery } from "../../middlewares/validate";
import { AuditLogsListQuerySchema } from "../../validation/auditLogs.schema";

export const auditLogsRouter = Router();

auditLogsRouter.get(
  "/",
  authenticate,
  requirePermission("audit.read"),
  validateQuery(AuditLogsListQuerySchema),
  asyncHandler(async (req, res) => {
    const { actorUserId, action, dateFrom, dateTo, page, limit } =
      req.query as any;

    const where: any = {};
    if (actorUserId) where.actorUserId = actorUserId;
    if (action) where.action = action;

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const skip = (page - 1) * limit;

    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          actorUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          meta: true,
          requestId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return ok(res, req, { items, page, limit, total, totalPages }, 200);
  })
);
