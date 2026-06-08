import 'dotenv/config';
import { buildApp } from './app';
import { config } from './config/env';
import logger from './shared/utils/logger';

async function main() {
  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port }, 'notifier service started');
  } catch (err) {
    logger.error({ err }, 'failed to start notifier service');
    process.exit(1);
  }
}

main();
