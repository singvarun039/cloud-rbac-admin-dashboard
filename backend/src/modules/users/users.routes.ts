import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/requirePermission";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UserIdParamSchema,
  UsersListQuerySchema,
} from "../../validation/users.schema";
import { listUsers, createUser, updateUser, permanentDeleteUser, deactivateUser } from "./users.controller";

export const usersRouter = Router();

usersRouter.get("/", authenticate, requirePermission("users.read"), validateQuery(UsersListQuerySchema), asyncHandler(listUsers));
usersRouter.post("/", authenticate, requirePermission("users.write"), validateBody(CreateUserBodySchema), asyncHandler(createUser));
usersRouter.patch("/:id", authenticate, requirePermission(["users.write", "users.edit"]), validateParams(UserIdParamSchema), validateBody(UpdateUserBodySchema), asyncHandler(updateUser));
usersRouter.delete("/:id/permanent", authenticate, requirePermission("users.write"), validateParams(UserIdParamSchema), asyncHandler(permanentDeleteUser));
usersRouter.delete("/:id", authenticate, requirePermission("users.write"), validateParams(UserIdParamSchema), asyncHandler(deactivateUser));
