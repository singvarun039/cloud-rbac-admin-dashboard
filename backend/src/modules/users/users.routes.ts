import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { fail, ok } from "../../utils/apiResponse";
import { hashPassword } from "../../utils/password";
import { writeAuditLog } from "../../services/auditLog.service";

export const usersRouter = Router();

usersRouter.get(
  "/",
  authenticate,
  requirePermission("users.read"),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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

    return ok(res, { users }, 200);
  }
);

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

usersRouter.post(
  "/",
  authenticate,
  requirePermission("users.write"),
  async (req, res) => {
    const parsed = CreateUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const { email, password, firstName, lastName } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return fail(res, 409, "CONFLICT", "User already exists");
    }

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

    return ok(res, { user }, 201);
  }
);

const UpdateUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    firstName: z.string().min(1).nullable().optional(),
    lastName: z.string().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

usersRouter.patch(
  "/:id",
  authenticate,
  requirePermission("users.write"),
  async (req, res) => {
    const userId = String(req.params.id ?? "").trim();
    if (!userId) {
      return fail(res, 400, "VALIDATION_ERROR", "User id is required");
    }

    const parsed = UpdateUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid request body");
    }

    const input = parsed.data;
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

    try {
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

      return ok(res, { user }, 200);
    } catch {
      return fail(res, 404, "NOT_FOUND", "User not found");
    }
  }
);

usersRouter.delete(
  "/:id",
  authenticate,
  requirePermission("users.write"),
  async (req, res) => {
    const userId = String(req.params.id ?? "").trim();
    if (!userId) {
      return fail(res, 400, "VALIDATION_ERROR", "User id is required");
    }

    try {
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

      return ok(res, { success: true }, 200);
    } catch {
      return fail(res, 404, "NOT_FOUND", "User not found");
    }
  }
);
