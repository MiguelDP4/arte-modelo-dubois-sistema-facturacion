import type { NextFunction, Request, Response } from 'express';
import * as productService from '../services/product.service';

export async function listPublicCatalog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await productService.listPublicCatalog({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getPublicCatalogItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const product = await productService.getPublicCatalogProduct(
      String(req.params.id),
    );
    res.status(200).json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const includePrices =
      req.user?.permissions.includes('products.read_prices') ?? false;
    const result = await productService.listProducts(
      {
        search:
          typeof req.query.search === 'string' ? req.query.search : undefined,
        includeArchived: req.query.includeArchived === 'true',
        lowStockOnly: req.query.lowStockOnly === 'true',
        page: req.query.page,
        pageSize: req.query.pageSize,
      },
      includePrices,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const includePrices =
      req.user?.permissions.includes('products.read_prices') ?? false;
    const product = await productService.getProductById(
      String(req.params.id),
      includePrices,
    );
    res.status(200).json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.createProduct(req.body, req.user!.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.updateProduct(
      String(req.params.id),
      req.body,
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.archiveProduct(String(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.restoreProduct(String(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listStockMovements(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await productService.listStockMovements(
      String(req.params.id),
    );
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function registerStockMovement(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await productService.registerStockMovement(
      String(req.params.id),
      req.body,
      req.user!.id,
    );
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
