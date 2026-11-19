import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { permissionsRouter } from './permissions.routes';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      status: 'ok',
      service: 'arte-modelo-dubois-api',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      success: false,
      status: 'degraded',
      service: 'arte-modelo-dubois-api',
    });
  }
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/permissions', permissionsRouter);
