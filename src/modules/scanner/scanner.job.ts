import cron from 'node-cron';
import { ScannerService } from './scanner.service';
import { config } from '../../config/env';
import logger from '../../shared/utils/logger';

export function startScannerJob(scannerService: ScannerService): void {
  const expression = `*/${config.scanner.intervalMinutes} * * * *`;
  let isRunning = false;

  logger.info({ expression }, 'scanner: cron started');

  cron.schedule(expression, async () => {
    if (isRunning) {
      logger.warn('scanner: still running, skipping tick');
      return;
    }

    isRunning = true;
    try {
      await scannerService.scan();
    } catch (err) {
      logger.error({ err }, 'scanner: unhandled error');
    } finally {
      isRunning = false;
    }
  });
}
