import { createApp } from './app';
import { bootstrapMasterUser, env } from '@moneyapp/shared/server';

async function main() {
  await bootstrapMasterUser();

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`MoneyAPP backend listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
