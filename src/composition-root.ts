import { SubscriptionService } from './modules/subscriptions/subscription.service';
import { ScannerService } from './modules/scanner/scanner.service';
import {
  SubscriptionRepository,
  RepositoryRepository,
} from './modules/subscriptions/subscription.repository';
import {
  RepositoryRepositoryPort,
  SubscriptionRepositoryPort,
} from './modules/subscriptions/subscription.ports';
import { GitHubService } from './modules/github/github.service';
import { githubClient } from './modules/github/github.client';
import { ReleaseProviderPort } from './modules/github/github.ports';
import { notifierPublisher } from './modules/notifier/notifier.publisher';
import { NotifierPort } from './modules/notifier/notifier.types';

/**
 * Overrides let tests substitute infrastructure adapters with fakes without
 * touching the wiring (DIP). Defaults resolve to production adapters.
 */
export interface AppDependencies {
  subscriptionRepo?: SubscriptionRepositoryPort;
  repositoryRepo?: RepositoryRepositoryPort;
  githubService?: ReleaseProviderPort;
  notifierService?: NotifierPort;
}

export interface Container {
  subscriptionService: SubscriptionService;
  scannerService: ScannerService;
}

/**
 * Single composition root (GRASP: Pure Fabrication / Creator). All concrete
 * adapters are instantiated and wired here, so services and controllers stay
 * free of construction details and depend only on abstractions.
 */
export function createContainer(overrides: AppDependencies = {}): Container {
  const subscriptionRepo = overrides.subscriptionRepo ?? new SubscriptionRepository();
  const repositoryRepo = overrides.repositoryRepo ?? new RepositoryRepository();
  const githubService = overrides.githubService ?? new GitHubService(githubClient);
  const notifierService = overrides.notifierService ?? notifierPublisher;

  const subscriptionService = new SubscriptionService(
    subscriptionRepo,
    repositoryRepo,
    githubService,
    notifierService,
  );

  const scannerService = new ScannerService(
    repositoryRepo,
    subscriptionRepo,
    githubService,
    notifierService,
  );

  return { subscriptionService, scannerService };
}
