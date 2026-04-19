import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/requirePermission';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import {
  CreateProjectBodySchema,
  PatchProjectBodySchema,
  ProjectIdParamSchema,
  ProjectsListQuerySchema,
} from '../../validation/projects.schema';
import { listProjects, createProject, updateProject, archiveProject } from './projects.controller';

export const projectsRouter = Router();

projectsRouter.get(
  '/',
  authenticate,
  requirePermission('projects.read'),
  validateQuery(ProjectsListQuerySchema),
  asyncHandler(listProjects)
);
projectsRouter.post(
  '/',
  authenticate,
  requirePermission('projects.write'),
  validateBody(CreateProjectBodySchema),
  asyncHandler(createProject)
);
projectsRouter.patch(
  '/:id',
  authenticate,
  requirePermission(['projects.write', 'projects.edit']),
  validateParams(ProjectIdParamSchema),
  validateBody(PatchProjectBodySchema),
  asyncHandler(updateProject)
);
projectsRouter.delete(
  '/:id',
  authenticate,
  requirePermission('projects.write'),
  validateParams(ProjectIdParamSchema),
  asyncHandler(archiveProject)
);
