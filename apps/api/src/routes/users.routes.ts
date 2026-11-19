import { Router } from 'express';
import { inviteUserSchema, updateUserSchema } from '@arte-modelo/shared';
import * as authController from '../controllers/auth.controller';
import * as usersController from '../controllers/users.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', requirePermission('users.read'), usersController.list);
usersRouter.post(
  '/invite',
  requirePermission('users.create'),
  validateBody(inviteUserSchema),
  authController.invite,
);
usersRouter.post(
  '/:id/resend-invitation',
  requirePermission('users.create'),
  usersController.resendInvitation,
);
usersRouter.patch(
  '/:id',
  requirePermission('users.update'),
  validateBody(updateUserSchema),
  usersController.update,
);
usersRouter.delete(
  '/:id',
  requirePermission('users.delete'),
  usersController.remove,
);
