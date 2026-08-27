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

  // Versão do build, injetada pelo docker-compose a partir do arquivo VERSION.
  // O front compara este par com o que ficou congelado no bundle dele para
  // saber que saiu deploy novo — ver frontend/src/composables/useVersionCheck.ts.
  app.get('/health', (_req, res) =>
    res.json({
      ok: true,
      version: process.env.APP_VERSION || '0.0.0',
      buildDate: process.env.APP_BUILD_DATE || null,
    }),
  );
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
