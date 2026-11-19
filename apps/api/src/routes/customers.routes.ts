import { Router } from 'express';
import {
  createCustomerSchema,
  linkCustomerUserSchema,
  updateCustomerSchema,
} from '@arte-modelo/shared';
import * as customersController from '../controllers/customers.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const customersRouter = Router();

customersRouter.use(requireAuth);

customersRouter.get('/', requirePermission('customers.read'), customersController.list);
customersRouter.get(
  '/unlinked-users',
  requirePermission('customers.manage'),
  customersController.listUnlinkedUsers,
);
customersRouter.get(
  '/:id',
  requirePermission('customers.read'),
  customersController.getById,
);
customersRouter.post(
  '/',
  requirePermission('customers.manage'),
  validateBody(createCustomerSchema),
  customersController.create,
);
customersRouter.patch(
  '/:id',
  requirePermission('customers.manage'),
  validateBody(updateCustomerSchema),
  customersController.update,
);
customersRouter.delete(
  '/:id',
  requirePermission('customers.manage'),
  customersController.archive,
);
customersRouter.post(
  '/:id/users',
  requirePermission('customers.manage'),
  validateBody(linkCustomerUserSchema),
  customersController.linkUser,
);
customersRouter.delete(
  '/:id/users/:userId',
  requirePermission('customers.manage'),
  customersController.unlinkUser,
);
