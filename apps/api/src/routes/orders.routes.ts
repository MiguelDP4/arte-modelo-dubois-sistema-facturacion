import { Router } from 'express';
import {
  cancelOrderSchema,
  confirmOrderSchema,
  createConsignmentReturnSchema,
  createDispatchSchema,
  createOrderSchema,
  createPaymentSchema,
  packOrderSchema,
  updateOrderSchema,
  voidPaymentSchema,
} from '@arte-modelo/shared';
import * as ordersController from '../controllers/orders.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get('/', requirePermission('orders.read'), ordersController.list);
ordersRouter.get(
  '/consignments',
  requirePermission('orders.read'),
  ordersController.listConsignments,
);
ordersRouter.get(
  '/last-price',
  requirePermission('products.read_prices'),
  ordersController.getLastPrice,
);
ordersRouter.get(
  '/:id/excel',
  requirePermission('orders.read'),
  ordersController.downloadExcel,
);
ordersRouter.get(
  '/:id/payments',
  requirePermission('payments.read'),
  ordersController.listPayments,
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
  '/:id/payments',
  requirePermission('payments.manage'),
  validateBody(createPaymentSchema),
  ordersController.addPayment,
);
ordersRouter.post(
  '/:id/payments/:paymentId/void',
  requirePermission('payments.manage'),
  validateBody(voidPaymentSchema),
  ordersController.voidPayment,
);
ordersRouter.post(
  '/:id/consignment-returns',
  requirePermission('consignments.manage'),
  validateBody(createConsignmentReturnSchema),
  ordersController.addConsignmentReturn,
);
ordersRouter.post(
  '/:id/cancel',
  requirePermission('orders.cancel'),
  validateBody(cancelOrderSchema),
  ordersController.cancel,
);
