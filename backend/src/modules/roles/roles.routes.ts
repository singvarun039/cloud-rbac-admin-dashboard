import { Router } from "express";
import { prisma } from "../../db/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { ok } from "../../utils/apiResponse";

export const rolesRouter = Router();

rolesRouter.get(
  "/",
  authenticate,
  requirePermission("roles.read"),
  async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok(res, { roles }, 200);
  }
);
