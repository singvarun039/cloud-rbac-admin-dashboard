import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/requirePermission';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import {
  AssignRoleBodySchema,
  CreateRoleBodySchema,
  PatchRoleBodySchema,
  PatchRoleParamsSchema,
  RolesListQuerySchema,
  RoleIdOrIdParamSchema,
  ReplaceRolePermissionsBodySchema,
} from '../../validation/roles.schema';
import {
  listRoles,
  createRole,
  updateRole,
  assignRole,
  replaceRolePermissions,
  deleteRolePermanent,
} from './roles.controller';

export const rolesRouter = Router();

rolesRouter.get(
  '/',
  authenticate,
  requirePermission('roles.read'),
  validateQuery(RolesListQuerySchema),
  asyncHandler(listRoles)
);
rolesRouter.post(
  '/',
  authenticate,
  requirePermission('roles.write'),
  validateBody(CreateRoleBodySchema),
  asyncHandler(createRole)
);
rolesRouter.patch(
  '/:id',
  authenticate,
  requirePermission(['roles.write', 'roles.edit']),
  validateParams(PatchRoleParamsSchema),
  validateBody(PatchRoleBodySchema),
  asyncHandler(updateRole)
);
rolesRouter.post(
  '/assign',
  authenticate,
  requirePermission('roles.write'),
  validateBody(AssignRoleBodySchema),
  asyncHandler(assignRole)
);
rolesRouter.post(
  '/:id/permissions',
  authenticate,
  requirePermission(['roles.write', 'roles.edit']),
  validateParams(RoleIdOrIdParamSchema),
  validateBody(ReplaceRolePermissionsBodySchema),
  asyncHandler(replaceRolePermissions)
);
rolesRouter.put(
  '/:roleId/permissions',
  authenticate,
  requirePermission(['roles.write', 'roles.edit']),
  validateParams(RoleIdOrIdParamSchema),
  validateBody(ReplaceRolePermissionsBodySchema),
  asyncHandler(replaceRolePermissions)
);
rolesRouter.delete(
  '/:id/permanent',
  authenticate,
  requirePermission('roles.write'),
  validateParams(PatchRoleParamsSchema),
  asyncHandler(deleteRolePermanent)
);
