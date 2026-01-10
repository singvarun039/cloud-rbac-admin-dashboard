import type { Request, Response, NextFunction } from "express";
import { fail } from "../utils/apiResponse";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../db/prisma";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return fail(res, 401, "UNAUTHORIZED", "Missing or invalid token");
  }

  const token = auth.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });

    if (!user || user.isActive !== true) {
      return fail(res, 401, "UNAUTHORIZED", "Missing or invalid token");
    }

    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
    req.user = { id: user.id, email: user.email, name, isActive: user.isActive };
    next();
  } catch {
    return fail(res, 401, "UNAUTHORIZED", "Missing or invalid token");
  }
}
