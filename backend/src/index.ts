import { createApp } from './app';
import { env, getDbHost } from './config/env';
import { logger } from './lib/logger';

const app = createApp();

app.listen(env.PORT, () => {
  // SECURITY: Log only safe fields. Never log DATABASE_URL or any secret.
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV, dbHost: getDbHost() }, 'server_listening');
});
