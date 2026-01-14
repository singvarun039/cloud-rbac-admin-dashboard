import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { ok } from "../../utils/apiResponse";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateQuery } from "../../middlewares/validate";
import { AuditLogsListQuerySchema } from "../../validation/auditLogs.schema";

export const auditLogsRouter = Router();

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function startOfDayUtc(dateOnly: string): Date {
  // Interpret YYYY-MM-DD as UTC midnight.
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function startOfNextDayUtc(dateOnly: string): Date {
  const d = startOfDayUtc(dateOnly);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function actorToApi(actor: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}) {
  const name =
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") || null;
  return {
    id: actor.id,
    email: actor.email,
    name,
  };
}

auditLogsRouter.get(
  "/",
  authenticate,
  requirePermission("audit.read"),
  validateQuery(AuditLogsListQuerySchema),
  asyncHandler(async (req, res) => {
    const {
      actorUserId,
      actorEmail,
      action,
      dateFrom,
      dateTo,
      entityType,
      entityId,
      requestId,
      page,
      limit,
    } = req.query as any;

    const where: any = {};
    if (actorUserId) where.actorUserId = actorUserId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (requestId) where.requestId = requestId;

    if (actorEmail) {
      where.actor = {
        email: {
          equals: String(actorEmail),
          mode: "insensitive",
        },
      };
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};

      if (dateFrom) {
        createdAt.gte = isDateOnly(String(dateFrom))
          ? startOfDayUtc(String(dateFrom))
          : new Date(String(dateFrom));
      }

      if (dateTo) {
        const dateToStr = String(dateTo);
        if (isDateOnly(dateToStr)) {
          createdAt.lt = startOfNextDayUtc(dateToStr);
        } else {
          createdAt.lte = new Date(dateToStr);
        }
      }

      where.createdAt = createdAt;
    }

    const skip = (page - 1) * limit;

    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          actorUserId: true,
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
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

    const hasNext = page * limit < total;
    const mapped = items.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      action: row.action,
      actorUserId: row.actorUserId,
      ...(row.actor ? { actor: actorToApi(row.actor) } : {}),
      entityType: row.entityType,
      entityId: row.entityId,
      requestId: row.requestId,
      meta: row.meta,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    }));

    return ok(
      res,
      req,
      { items: mapped, meta: { page, limit, total, hasNext } },
      200
    );
  })
);
