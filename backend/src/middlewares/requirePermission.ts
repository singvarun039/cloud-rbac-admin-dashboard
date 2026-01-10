import type { Request, Response, NextFunction } from "express";
import { fail } from "../utils/apiResponse";

export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, 401, "UNAUTHORIZED", "Missing or invalid token");
    }

    if (!req.user.permissions?.includes(permissionKey)) {
      return fail(res, 403, "FORBIDDEN", "Insufficient permissions");
    }

    return next();
  };
}
