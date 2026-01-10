import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../services/auditLog.service";
import { AppError } from "../../errors/AppError";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };

    const userAgent = req.get("user-agent") ?? null;
    const ipAddress = req.ip ?? null;

    const result = await AuthService.login(
      { email, password },
      { userAgent, ipAddress }
    );

    if (!result) {
      // Optional: login failure audit (no actor)
      await writeAuditLog({
        req,
        action: "LOGIN_FAILURE",
        entityType: "Auth",
        entityId: null,
        actorUserId: null,
        meta: {
          email: String(email ?? "")
            .trim()
            .toLowerCase(),
        },
      });
      throw AppError.unauthorized("Invalid email or password");
    }

    await writeAuditLog({
      req,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: result.user.id,
      actorUserId: result.user.id,
      meta: { email: result.user.email },
    });

    return ok(res, req, result, 200);
  }

  static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body as { refreshToken: string };

    const userAgent = req.get("user-agent") ?? null;
    const ipAddress = req.ip ?? null;

    const result = await AuthService.refresh(refreshToken, {
      userAgent,
      ipAddress,
    });

    if (!result) {
      throw AppError.unauthorized("Invalid refresh token");
    }

    return ok(res, req, result, 200);
  }

  static async logout(req: Request, res: Response) {
    const { refreshToken } = req.body as { refreshToken: string };

    const result = await AuthService.logout(refreshToken);
    return ok(res, req, result, 200);
  }

  static async me(req: Request, res: Response) {
    if (!req.user) {
      throw AppError.unauthorized();
    }

    const { id, email, name, permissions } = req.user;
    return ok(res, req, { user: { id, email, name }, permissions }, 200);
  }
}
