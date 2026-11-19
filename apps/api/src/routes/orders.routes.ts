import { Router } from 'express';
import {
  cancelOrderSchema,
  confirmOrderSchema,
  createDispatchSchema,
  createOrderSchema,
  packOrderSchema,
  updateOrderSchema,
} from '@arte-modelo/shared';
import * as ordersController from '../controllers/orders.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get('/', requirePermission('orders.read'), ordersController.list);
ordersRouter.get(
  '/last-price',
  requirePermission('products.read_prices'),
  ordersController.getLastPrice,
);
ordersRouter.get(
  '/:id',
  requirePermission('orders.read'),
  ordersController.getById,
);

ordersRouter.post(
  '/',
  requirePermission('orders.create'),
  validateBody(createOrderSchema),
  ordersController.create,
);
ordersRouter.post(
  '/:id/confirm',
  requirePermission('orders.confirm'),
  validateBody(confirmOrderSchema),
  ordersController.confirm,
);
ordersRouter.patch(
  '/:id',
  requirePermission('orders.manage'),
  validateBody(updateOrderSchema),
  ordersController.update,
);
ordersRouter.post(
  '/:id/pack',
  requirePermission('orders.manage'),
  validateBody(packOrderSchema),
  ordersController.pack,
);
ordersRouter.post(
  '/:id/dispatches',
  requirePermission('orders.manage'),
  validateBody(createDispatchSchema),
  ordersController.dispatch,
);
ordersRouter.post(
  '/:id/cancel',
  requirePermission('orders.cancel'),
  validateBody(cancelOrderSchema),
  ordersController.cancel,
);
