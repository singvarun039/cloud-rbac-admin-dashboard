import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { verifyAccessToken } from "../utils/jwt";
import {
  fetchUserWithRolesAndPermissions,
  computeEffectivePermissionKeys,
} from "../utils/rbac";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return next(AppError.unauthorized());
  }

  const token = auth.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);

    const user = await fetchUserWithRolesAndPermissions({
      userId: payload.sub,
    });

    // NOTE: This codebase models "ACTIVE" via boolean `isActive`.
    if (!user || user.isActive !== true) {
      return next(AppError.unauthorized());
    }

    const permissions = computeEffectivePermissionKeys(user);
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
    req.user = { id: user.id, email: user.email, name, permissions };
    return next();
  } catch {
    return next(AppError.unauthorized());
  }
}
