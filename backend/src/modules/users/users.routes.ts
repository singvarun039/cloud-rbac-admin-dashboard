import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { fail, ok } from "../../utils/apiResponse";
import { hashPassword } from "../../utils/password";

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

    return ok(res, { user }, 201);
  }
);
