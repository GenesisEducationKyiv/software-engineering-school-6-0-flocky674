import 'dotenv/config';
import { buildApp } from './app';
import { startScannerJob } from './modules/scanner/scanner.job';
import { ScannerService } from './modules/scanner/scanner.service';
import { SubscriptionRepository, RepositoryRepository } from './modules/subscriptions/subscription.repository';
import { GitHubService } from './modules/github/github.service';
import { githubClient } from './modules/github/github.client';
import { resolveNotifier } from './modules/notifier/notifier.factory';
import { config } from './config/env';
import logger from './shared/utils/logger';

async function main() {
  const app = buildApp();

  const scannerService = new ScannerService(
    new RepositoryRepository(),
    new SubscriptionRepository(),
    new GitHubService(githubClient),
    resolveNotifier(),
  );

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
