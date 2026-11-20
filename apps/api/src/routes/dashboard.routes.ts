import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { requireAuth } from '../middlewares/auth.middleware';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/', dashboardController.getSummary);
