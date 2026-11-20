import type { NextFunction, Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await dashboardService.getDashboardSummary(req.user!);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
