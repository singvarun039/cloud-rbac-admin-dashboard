import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateBody } from "../../middlewares/validate";
import {
  LoginBodySchema,
  RefreshBodySchema,
} from "../../validation/auth.schema";

export const authRouter = Router();

authRouter.post(
  "/login",
  validateBody(LoginBodySchema),
  asyncHandler(AuthController.login)
);
authRouter.post(
  "/refresh",
  validateBody(RefreshBodySchema),
  asyncHandler(AuthController.refresh)
);
authRouter.post(
  "/logout",
  validateBody(RefreshBodySchema),
  asyncHandler(AuthController.logout)
);
authRouter.get("/me", authenticate, asyncHandler(AuthController.me));
