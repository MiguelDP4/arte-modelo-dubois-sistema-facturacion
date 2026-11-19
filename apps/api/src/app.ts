import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '8mb' }));
  app.use(cookieParser());

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
