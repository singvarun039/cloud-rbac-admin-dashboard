import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { fail, ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../services/auditLog.service";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return fail(
        res,
        400,
        "VALIDATION_ERROR",
        "Email and password are required"
      );
    }

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
      return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    await writeAuditLog({
      req,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: result.user.id,
      actorUserId: result.user.id,
      meta: { email: result.user.email },
    });

    return ok(res, result, 200);
  }

  static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken || typeof refreshToken !== "string") {
      return fail(res, 400, "VALIDATION_ERROR", "Refresh token is required");
    }

    const userAgent = req.get("user-agent") ?? null;
    const ipAddress = req.ip ?? null;

    const result = await AuthService.refresh(refreshToken, {
      userAgent,
      ipAddress,
    });

    if (!result) {
      return fail(res, 401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
    }

    return ok(res, result, 200);
  }

  static async logout(req: Request, res: Response) {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken || typeof refreshToken !== "string") {
      return fail(res, 400, "VALIDATION_ERROR", "Refresh token is required");
    }

    const result = await AuthService.logout(refreshToken);
    return ok(res, result, 200);
  }

  static async me(req: Request, res: Response) {
    if (!req.user) {
      return fail(res, 401, "UNAUTHORIZED", "Missing or invalid token");
    }

    const { id, email, name, permissions } = req.user;
    return ok(res, { user: { id, email, name }, permissions }, 200);
  }
}
