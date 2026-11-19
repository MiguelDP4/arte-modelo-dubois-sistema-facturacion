import { Router } from 'express';
import {
  createProductSchema,
  createStockMovementSchema,
  updateProductSchema,
} from '@arte-modelo/shared';
import * as productsController from '../controllers/products.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get('/', requirePermission('products.read'), productsController.list);
productsRouter.get(
  '/:id',
  requirePermission('products.read'),
  productsController.getById,
);
productsRouter.post(
  '/',
  requirePermission('products.manage'),
  validateBody(createProductSchema),
  productsController.create,
);
productsRouter.patch(
  '/:id',
  requirePermission('products.manage'),
  validateBody(updateProductSchema),
  productsController.update,
);
productsRouter.delete(
  '/:id',
  requirePermission('products.manage'),
  productsController.archive,
);
productsRouter.post(
  '/:id/restore',
  requirePermission('products.manage'),
  productsController.restore,
);
productsRouter.get(
  '/:id/stock-movements',
  requirePermission('products.read_prices'),
  productsController.listStockMovements,
);
productsRouter.post(
  '/:id/stock-movements',
  requirePermission('products.manage'),
  validateBody(createStockMovementSchema),
  productsController.registerStockMovement,
);
