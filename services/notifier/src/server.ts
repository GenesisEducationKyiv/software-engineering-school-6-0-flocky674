import 'dotenv/config';
import { buildApp } from './app';
import { config } from './config/env';
import { getChannel } from './messaging/connection';
import { startEmailConsumer } from './messaging/email.consumer';
import { NotifierService } from './notifier/notifier.service';
import logger from './shared/utils/logger';

async function main() {
  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port }, 'notifier service started');

    const channel = await getChannel();
    await startEmailConsumer(channel, new NotifierService());
  } catch (err) {
    logger.error({ err }, 'failed to start notifier service');
    process.exit(1);
  }
}

main();
