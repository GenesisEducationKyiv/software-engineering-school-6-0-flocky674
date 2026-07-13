import {
  RepositoryRepositoryPort,
  SubscriptionRepositoryPort,
} from './subscription.ports';
import { ReleaseProviderPort } from '../github/github.ports';
import { NotifierPort } from '../notifier/notifier.types';
import { EmailAddress } from './email';
import { toSubscriptionResponse } from './subscription.mapper';
import { CreateSubscriptionInput, SubscriptionResponse } from './subscription.dto';
import { parseRepo } from '../../shared/utils/parse-repo';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';

export type { CreateSubscriptionInput, SubscriptionResponse } from './subscription.dto';

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly repositoryRepo: RepositoryRepositoryPort,
    private readonly githubService: ReleaseProviderPort,
    private readonly notifierService: NotifierPort,
  ) {}

  async subscribe(input: CreateSubscriptionInput): Promise<void> {
    const email = EmailAddress.create(input.email).value;
    const { owner, name, fullName } = parseRepo(input.repo);

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
    return subs.map(toSubscriptionResponse);
  }
}
