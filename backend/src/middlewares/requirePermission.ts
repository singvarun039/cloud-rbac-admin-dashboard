import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

// Ensures the authenticated user has at least one required permission.
export function requirePermission(permissionKey: string | string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }

    const required = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
    const userPermissions = req.user.permissions ?? [];

    const hasAny = required.some((key) => userPermissions.includes(key));
    if (!hasAny) {
      throw AppError.forbidden();
    }

    return next();
  };
}
