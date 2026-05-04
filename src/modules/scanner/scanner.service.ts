import { Repository } from '@prisma/client';
import { RepositoryRepository, SubscriptionRepository } from '../subscriptions/subscription.repository';
import { GitHubService } from '../github/github.service';
import { NotifierService } from '../notifier/notifier.service';
import { RateLimitError } from '../../shared/errors/app-error';
import logger from '../../shared/utils/logger';

export class ScannerService {
  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly githubService: GitHubService,
    private readonly notifierService: NotifierService,
  ) {}

  async scan(): Promise<void> {
    logger.info('scanner: starting cycle');

    let repositories: Repository[];
    try {
      repositories = await this.repositoryRepo.findAllWithConfirmedSubscriptions();
    } catch (err) {
      logger.error({ err }, 'scanner: failed to load repositories');
      return;
    }

    logger.info({ count: repositories.length }, 'scanner: repos to check');

    for (const repo of repositories) {
      await this.checkRepository(repo);
    }
  }

  private async checkRepository(repo: Repository): Promise<void> {
    try {
      const latestRelease = await this.githubService.getLatestRelease(repo.owner, repo.name);

      await this.repositoryRepo.updateLastCheckedAt(repo.id);

      if (!latestRelease) {
        return;
      }

      const newTag = latestRelease.tag_name;

      if (!repo.lastSeenTag) {
        await this.repositoryRepo.updateLastSeenTag(repo.id, newTag);
        return;
      }

      if (repo.lastSeenTag === newTag) {
        return;
      }

      logger.info({ repo: repo.fullName, from: repo.lastSeenTag, to: newTag }, 'scanner: new release');

      await this.repositoryRepo.updateLastSeenTag(repo.id, newTag);

      const subscribers = await this.subscriptionRepo.findConfirmedByRepositoryId(repo.id);

      for (const sub of subscribers) {
        try {
          await this.notifierService.sendReleaseNotification({
            email: sub.email,
            repoFullName: repo.fullName,
            tagName: newTag,
            releaseName: latestRelease.name,
            releaseUrl: latestRelease.html_url,
            unsubscribeToken: sub.unsubscribeToken,
          });
        } catch (err) {
          logger.error({ err, email: sub.email }, 'scanner: failed to send email');
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        logger.warn({ repo: repo.fullName }, 'scanner: rate limit, skipping cycle');
        throw err;
      }
      logger.error({ err, repo: repo.fullName }, 'scanner: error checking repo');
    }
  }
}
