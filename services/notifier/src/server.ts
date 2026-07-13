import 'dotenv/config';
import { buildApp } from './app';
import { config } from './config/env';
import { getChannel } from './messaging/connection';
import { startEmailConsumer } from './messaging/email.consumer';
import { startMailGrpcServer } from './grpc/mail.grpc.server';
import { NotifierService } from './notifier/notifier.service';
import logger from './shared/utils/logger';

async function main() {
  const app = buildApp();
  const notifierService = new NotifierService();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port }, 'notifier service started');

    const channel = await getChannel();
    await startEmailConsumer(channel, notifierService);

    await startMailGrpcServer(notifierService, config.grpc.host, config.grpc.port);
  } catch (err) {
    logger.error({ err }, 'failed to start notifier service');
    process.exit(1);
  }
}

main();
