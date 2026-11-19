import type { NextFunction, Request, Response } from 'express';
import * as storageService from '../services/storage.service';

export async function uploadProductImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await storageService.uploadProductImage(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export function serveLocalProductImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { filePath } = storageService.resolveLocalProductImagePath(
      String(req.params.fileName),
    );
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}
