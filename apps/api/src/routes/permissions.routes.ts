import { Router } from 'express';
import { updateRolePermissionsSchema } from '@arte-modelo/shared';
import * as permissionsController from '../controllers/permissions.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const permissionsRouter = Router();

permissionsRouter.use(requireAuth, requirePermission('permissions.manage'));

permissionsRouter.get('/', permissionsController.getMatrix);
permissionsRouter.put(
  '/role/:role',
  validateBody(updateRolePermissionsSchema),
  permissionsController.updateRole,
);
