import { PrismaClient, Subscription, Repository } from '@prisma/client';
import defaultPrisma from '../../shared/db/prisma';
import {
  CreateSubscriptionData,
  RepositoryRepositoryPort,
  SubscriptionRepositoryPort,
  SubscriptionWithRepo,
  UpsertRepositoryData,
} from './subscription.ports';

export type { SubscriptionWithRepo } from './subscription.ports';

export class SubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  findById(id: string): Promise<SubscriptionWithRepo | null> {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: { repository: true },
    });
  }

  findByEmailAndRepo(email: string, repositoryId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: { email_repositoryId: { email, repositoryId } },
    });
  }

  findByConfirmToken(token: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { confirmToken: token } });
  }

  findByUnsubscribeToken(token: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { unsubscribeToken: token } });
  }

  findActiveByEmail(email: string): Promise<SubscriptionWithRepo[]> {
    return this.prisma.subscription.findMany({
      where: { email, isActive: true, confirmedAt: { not: null } },
      include: { repository: true },
    });
  }

  findConfirmedByRepositoryId(repositoryId: string): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { repositoryId, isActive: true, confirmedAt: { not: null } },
    });
  }

  create(data: CreateSubscriptionData): Promise<Subscription> {
    return this.prisma.subscription.create({ data });
  }

  confirm(id: string): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: { id },
      data: { isActive: true, confirmedAt: new Date() },
    });
  }

  deactivate(id: string): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deactivateByUnsubscribeToken(token: string): Promise<Subscription | null> {
    const sub = await this.findByUnsubscribeToken(token);
    if (!sub) return null;
    return this.deactivate(sub.id);
  }
}

export class RepositoryRepository implements RepositoryRepositoryPort {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  findByFullName(fullName: string): Promise<Repository | null> {
    return this.prisma.repository.findUnique({ where: { fullName } });
  }

  upsert(data: UpsertRepositoryData): Promise<Repository> {
    return this.prisma.repository.upsert({
      where: { fullName: data.fullName },
      create: {
        fullName: data.fullName,
        owner: data.owner,
        name: data.name,
        lastSeenTag: data.lastSeenTag ?? null,
      },
      update: {},
    });
  }

  updateLastSeenTag(id: string, tag: string): Promise<Repository> {
    return this.prisma.repository.update({
      where: { id },
      data: { lastSeenTag: tag, lastCheckedAt: new Date() },
    });
  }

  async updateLastCheckedAt(id: string): Promise<void> {
    await this.prisma.repository.update({
      where: { id },
      data: { lastCheckedAt: new Date() },
    });
  }

  findAllWithConfirmedSubscriptions(): Promise<Repository[]> {
    return this.prisma.repository.findMany({
      where: {
        subscriptions: {
          some: { isActive: true, confirmedAt: { not: null } },
        },
      },
    });
  }
}
