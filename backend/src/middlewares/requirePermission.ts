import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

export function requirePermission(permissionKey: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }

    if (!req.user.permissions?.includes(permissionKey)) {
      throw AppError.forbidden();
    }

    return next();
  };
}
