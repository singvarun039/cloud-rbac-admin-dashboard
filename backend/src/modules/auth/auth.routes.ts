import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateBody } from "../../middlewares/validate";
import { env } from "../../config/env";
import { fail } from "../../utils/apiResponse";
import {
  LoginBodySchema,
  RefreshBodySchema,
} from "../../validation/auth.schema";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip ?? "";
    const emailRaw = (req.body as any)?.email;
    const email =
      typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    return email ? `${ip}|${email}` : ip;
  },
  handler: (req, res) => {
    return fail(
      res,
      req,
      429,
      "RATE_LIMITED",
      "Too many login attempts. Please try again later.",
    );
  },
});

const refreshLimiter = rateLimit({
  windowMs: env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_REFRESH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "",
  handler: (req, res) => {
    return fail(
      res,
      req,
      429,
      "RATE_LIMITED",
      "Too many refresh attempts. Please try again later.",
    );
  },
});

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(LoginBodySchema),
  asyncHandler(AuthController.login),
);
authRouter.post(
  "/refresh",
  refreshLimiter,
  validateBody(RefreshBodySchema),
  asyncHandler(AuthController.refresh),
);
authRouter.post(
  "/logout",
  validateBody(RefreshBodySchema),
  asyncHandler(AuthController.logout),
);
authRouter.get("/me", authenticate, asyncHandler(AuthController.me));
