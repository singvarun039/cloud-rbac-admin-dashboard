import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { AppError } from "../../errors/AppError";
import { ok } from "../../utils/apiResponse";
import { hashPassword } from "../../utils/password";
import { writeAuditLog } from "../../services/auditLog.service";
import { asyncHandler } from "../../middlewares/asyncHandler";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UserIdParamSchema,
  UsersListQuerySchema,
} from "../../validation/users.schema";

export const usersRouter = Router();

function nameToFirstLast(name: string): { firstName: string; lastName: string | null } {
  const normalized = name.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");

  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { firstName, lastName };
}

function userToApi(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  const status = user.isActive ? "ACTIVE" : "INACTIVE";

  return {
    id: user.id,
    email: user.email,
    name,
    status,
    createdAt: user.createdAt,
    ...(user.updatedAt ? { updatedAt: user.updatedAt } : {}),
  };
}

usersRouter.get(
  "/",
  authenticate,
  requirePermission("users.read"),
  validateQuery(UsersListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, search, status } = req.query as any;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: String(search), mode: "insensitive" } },
        { firstName: { contains: String(search), mode: "insensitive" } },
        { lastName: { contains: String(search), mode: "insensitive" } },
      ];
    }

    if (status === "ACTIVE") where.isActive = true;
    if (status === "INACTIVE") where.isActive = false;

    const skip = (page - 1) * limit;

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const items = users.map((u) => userToApi(u));
    const hasNext = page * limit < total;

    return ok(res, req, { items, meta: { page, limit, total, hasNext } }, 200);
  })
);

usersRouter.post(
  "/",
  authenticate,
  requirePermission("users.write"),
  validateBody(CreateUserBodySchema),
  asyncHandler(async (req, res) => {
    const { email, password, name, status } = req.body as any;

    const passwordHash = await hashPassword(password);
    const parsedName = nameToFirstLast(String(name));
    const isActive = status === "ACTIVE";

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        isActive,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      req,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: user.id,
      actorUserId: req.user?.id ?? null,
      meta: {
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
      },
    });

    return ok(res, req, { user: userToApi(user) }, 201);
  })
);

usersRouter.patch(
  "/:id",
  authenticate,
  requirePermission("users.write"),
  validateParams(UserIdParamSchema),
  validateBody(UpdateUserBodySchema),
  asyncHandler(async (req, res) => {
    const userId = (req.params as any).id as string;
    const input = req.body as any;
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!before) {
      throw AppError.notFound("User not found");
    }

    const data: any = {};
    if (typeof input.email === "string") data.email = input.email;
    if (typeof input.status === "string") data.isActive = input.status === "ACTIVE";

    if (typeof input.name === "string") {
      const parsedName = nameToFirstLast(input.name);
      data.firstName = parsedName.firstName;
      data.lastName = parsedName.lastName;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const changes: Record<string, { from: string | null; to: string | null }> =
      {};
    if (typeof input.email === "string" && input.email !== before.email) {
      changes.email = { from: before.email, to: user.email };
    }

    if (typeof input.status === "string") {
      const beforeStatus = before.isActive ? "ACTIVE" : "INACTIVE";
      const afterStatus = user.isActive ? "ACTIVE" : "INACTIVE";
      if (beforeStatus !== afterStatus) {
        changes.status = { from: beforeStatus, to: afterStatus };
      }
    }

    if (typeof input.name === "string") {
      const beforeName =
        [before.firstName, before.lastName].filter(Boolean).join(" ") || null;
      const afterName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
      if (beforeName !== afterName) {
        changes.name = { from: beforeName, to: afterName };
      }
    }

    await writeAuditLog({
      req,
      action: "USER_UPDATED",
      entityType: "USER",
      entityId: user.id,
      actorUserId: req.user?.id ?? null,
      meta: {
        changes: Object.keys(changes).length > 0 ? changes : {},
      },
    });

    return ok(res, req, { user: userToApi(user) }, 200);
  })
);

usersRouter.delete(
  "/:id",
  authenticate,
  requirePermission("users.write"),
  validateParams(UserIdParamSchema),
  asyncHandler(async (req, res) => {
    const userId = (req.params as any).id as string;

    const disabled = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      req,
      action: "USER_DELETED",
      entityType: "USER",
      entityId: disabled.id,
      actorUserId: req.user?.id ?? null,
      meta: {
        email: disabled.email,
        name:
          [disabled.firstName, disabled.lastName].filter(Boolean).join(" ") ||
          null,
        status: disabled.isActive ? "ACTIVE" : "INACTIVE",
      },
    });

    return ok(res, req, { success: true }, 200);
  })
);
