import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { ok } from "../../utils/apiResponse";
import { hashPassword } from "../../utils/password";
import { writeAuditLog } from "../../services/auditLog.service";
import { asyncHandler } from "../../middlewares/asyncHandler";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import { ListQuerySchema } from "../../validation/list.schema";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UserIdParamSchema,
} from "../../validation/users.schema";

export const usersRouter = Router();

usersRouter.get(
  "/",
  authenticate,
  requirePermission("users.read"),
  validateQuery(ListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, search } = req.query as any;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: String(search), mode: "insensitive" } },
        { firstName: { contains: String(search), mode: "insensitive" } },
        { lastName: { contains: String(search), mode: "insensitive" } },
      ];
    }

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

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return ok(res, req, { users, page, limit, total, totalPages }, 200);
  })
);

usersRouter.post(
  "/",
  authenticate,
  requirePermission("users.write"),
  validateBody(CreateUserBodySchema),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName } = req.body as any;

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      req,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      meta: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
    });

    return ok(res, req, { user }, 201);
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
    const updatedFields = Object.keys(input).filter((k) => k !== "password");

    const data: any = {};
    if (typeof input.email === "string") data.email = input.email;
    if (typeof input.firstName !== "undefined")
      data.firstName = input.firstName;
    if (typeof input.lastName !== "undefined") data.lastName = input.lastName;
    if (typeof input.isActive === "boolean") data.isActive = input.isActive;
    if (typeof input.password === "string") {
      data.passwordHash = await hashPassword(input.password);
      updatedFields.push("password");
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

    await writeAuditLog({
      req,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: user.id,
      meta: {
        updatedFields,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
    });

    return ok(res, req, { user }, 200);
  })
);

usersRouter.delete(
  "/:id",
  authenticate,
  requirePermission("users.write"),
  validateParams(UserIdParamSchema),
  asyncHandler(async (req, res) => {
    const userId = (req.params as any).id as string;

    const deleted = await prisma.user.delete({
      where: { id: userId },
      select: { id: true, email: true },
    });

    await writeAuditLog({
      req,
      action: "USER_DELETED",
      entityType: "User",
      entityId: deleted.id,
      meta: { email: deleted.email },
    });

    return ok(res, req, { success: true }, 200);
  })
);
