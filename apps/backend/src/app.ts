import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from '@moneyapp/services';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '30mb' }));
  app.use(pinoHttp());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiRouter);

  // Final error handler — keep responses small and don't leak stack traces.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).json({ error: 'internal_error' });
    },
  );

  return app;
}
