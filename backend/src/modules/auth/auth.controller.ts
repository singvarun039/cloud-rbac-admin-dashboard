import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { fail, ok } from "../../utils/apiResponse";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return fail(res, 400, "VALIDATION_ERROR", "Email and password are required");
    }

    const result = await AuthService.login({ email, password });

    if (!result) {
      return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    return ok(res, result, 200);
  }

  static async me(req: Request, res: Response) {
    if (!req.user) {
      return fail(res, 401, "UNAUTHORIZED", "Missing or invalid token");
    }

    const { id, email, name } = req.user;
    return ok(res, { user: { id, email, name } }, 200);
  }
}
