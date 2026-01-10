import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { fail, ok } from "../../utils/apiResponse";

export const auditLogsRouter = Router();

auditLogsRouter.get(
  "/",
  authenticate,
  requirePermission("audit.read"),
  async (req, res) => {
    const QuerySchema = z.object({
      actorUserId: z.string().min(1).optional(),
      action: z.string().min(1).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid query params");
    }

    const { actorUserId, action, dateFrom, dateTo, page, limit } = parsed.data;

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

    return ok(
      res,
      {
        items,
        page,
        limit,
        total,
        totalPages,
      },
      200
    );
  }
);
