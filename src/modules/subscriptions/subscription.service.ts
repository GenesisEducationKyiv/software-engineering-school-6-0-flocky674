import {
  SubscriptionRepository,
  RepositoryRepository,
  SubscriptionWithRepo,
} from './subscription.repository';
import { GitHubService } from '../github/github.service';
import { NotifierService } from '../notifier/notifier.service';
import { parseRepo } from '../../shared/utils/parse-repo';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';

export interface CreateSubscriptionInput {
  email: string;
  repo: string;
}

export interface SubscriptionResponse {
  id: string;
  email: string;
  repo: string;
  isActive: boolean;
  confirmedAt: string | null;
  createdAt: string;
}

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly repositoryRepo: RepositoryRepository,
    private readonly githubService: GitHubService,
    private readonly notifierService: NotifierService,
  ) {}

  async subscribe(input: CreateSubscriptionInput): Promise<void> {
    const { email, repo } = input;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError('Invalid email address');
    }

    const { owner, name, fullName } = parseRepo(repo);

    await this.githubService.verifyRepo(owner, name);

    const latestRelease = await this.githubService.getLatestRelease(owner, name);

    const repository = await this.repositoryRepo.upsert({
      fullName,
      owner,
      name,
      lastSeenTag: latestRelease?.tag_name ?? null,
    });

    const existing = await this.subscriptionRepo.findByEmailAndRepo(email, repository.id);

    if (existing) {
      if (existing.isActive && existing.confirmedAt) {
        throw new ConflictError(`${email} is already subscribed to ${fullName}`);
      }

      if (!existing.confirmedAt) {
        // resend confirmation if pending
        await this.notifierService.sendConfirmationEmail({
          email,
          repoFullName: fullName,
          confirmToken: existing.confirmToken,
        });
        return;
      }
    }

    const subscription = await this.subscriptionRepo.create({ email, repositoryId: repository.id });

    await this.notifierService.sendConfirmationEmail({
      email,
      repoFullName: fullName,
      confirmToken: subscription.confirmToken,
    });
  }

  async confirm(token: string): Promise<void> {
    const sub = await this.subscriptionRepo.findByConfirmToken(token);
    if (!sub) {
      throw new NotFoundError('Invalid or expired confirmation token');
    }
    if (sub.confirmedAt) {
      return; // already confirmed, idempotent
    }
    await this.subscriptionRepo.confirm(sub.id);
  }

  async unsubscribe(token: string): Promise<void> {
    const result = await this.subscriptionRepo.deactivateByUnsubscribeToken(token);
    if (!result) {
      throw new NotFoundError('Invalid or expired unsubscribe token');
    }
  }

  async getSubscriptionsByEmail(email: string): Promise<SubscriptionResponse[]> {
    if (!email) {
      throw new BadRequestError('Email parameter is required');
    }
    const subs = await this.subscriptionRepo.findActiveByEmail(email);
    return subs.map((sub) => this.formatResponse(sub, sub.repository.fullName));
  }

  private formatResponse(sub: SubscriptionWithRepo, repoFullName: string): SubscriptionResponse {
    return {
      id: sub.id,
      email: sub.email,
      repo: repoFullName,
      isActive: sub.isActive,
      confirmedAt: sub.confirmedAt?.toISOString() ?? null,
      createdAt: sub.createdAt.toISOString(),
    };
  }
}
