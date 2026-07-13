import 'dotenv/config';
import { buildApp } from './app';
import { createContainer } from './composition-root';
import { startScannerJob } from './modules/scanner/scanner.job';
import { config } from './config/env';
import logger from './shared/utils/logger';

async function main() {
  const app = buildApp();

  const { scannerService } = createContainer();
  startScannerJob(scannerService);

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port }, 'server started');
  } catch (err) {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  }
}

main();
