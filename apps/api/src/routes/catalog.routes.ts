import { Router } from 'express';
import * as productsController from '../controllers/products.controller';

export const catalogRouter = Router();

catalogRouter.get('/', productsController.listPublicCatalog);
catalogRouter.get('/:id', productsController.getPublicCatalogItem);
