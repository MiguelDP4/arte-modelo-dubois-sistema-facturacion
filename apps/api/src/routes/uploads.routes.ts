import { Router } from 'express';
import { uploadImageSchema } from '@arte-modelo/shared';
import * as uploadsController from '../controllers/uploads.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export const uploadsRouter = Router();

uploadsRouter.get('/products/:fileName', uploadsController.serveLocalProductImage);
uploadsRouter.post(
  '/product-image',
  requireAuth,
  requirePermission('products.manage'),
  validateBody(uploadImageSchema),
  uploadsController.uploadProductImage,
);
uploadsRouter.post(
  '/payment-receipt',
  requireAuth,
  requirePermission('payments.manage'),
  validateBody(uploadImageSchema),
  uploadsController.uploadProductImage,
);
