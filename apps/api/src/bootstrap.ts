import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { loadConfig } from './config';

/** Shared HTTP setup for main.ts and tests. */
export function configureApp(app: INestApplication) {
  const cfg = loadConfig();
  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({ origin: cfg.WEB_ORIGIN.split(','), credentials: true });
  const http = app.getHttpAdapter().getInstance();
  http.set?.('trust proxy', 1);
  app.enableShutdownHooks();
  return app;
}
