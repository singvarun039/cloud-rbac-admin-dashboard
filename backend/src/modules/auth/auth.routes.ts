import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middlewares/authenticate";

export const authRouter = Router();

authRouter.post("/login", AuthController.login);
authRouter.get("/me", authenticate, AuthController.me);
