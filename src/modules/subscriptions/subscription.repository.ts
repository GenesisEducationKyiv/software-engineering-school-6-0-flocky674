import { Subscription, Repository } from '@prisma/client';
import prisma from '../../shared/db/prisma';

export type SubscriptionWithRepo = Subscription & { repository: Repository };

export class SubscriptionRepository {
  findById(id: string) {
    return prisma.subscription.findUnique({
      where: { id },
      include: { repository: true },
    });
  }

  findByEmailAndRepo(email: string, repositoryId: string) {
    return prisma.subscription.findUnique({
      where: { email_repositoryId: { email, repositoryId } },
    });
  }

  findByConfirmToken(token: string) {
    return prisma.subscription.findUnique({ where: { confirmToken: token } });
  }

  findByUnsubscribeToken(token: string) {
    return prisma.subscription.findUnique({ where: { unsubscribeToken: token } });
  }

  findActiveByEmail(email: string): Promise<SubscriptionWithRepo[]> {
    return prisma.subscription.findMany({
      where: { email, isActive: true, confirmedAt: { not: null } },
      include: { repository: true },
    });
  }

  findConfirmedByRepositoryId(repositoryId: string) {
    return prisma.subscription.findMany({
      where: { repositoryId, isActive: true, confirmedAt: { not: null } },
    });
  }

  create(data: { email: string; repositoryId: string }) {
    return prisma.subscription.create({ data });
  }

  confirm(id: string) {
    return prisma.subscription.update({
      where: { id },
      data: { isActive: true, confirmedAt: new Date() },
    });
  }

  deactivate(id: string) {
    return prisma.subscription.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deactivateByUnsubscribeToken(token: string): Promise<Subscription | null> {
    const sub = await this.findByUnsubscribeToken(token);
    if (!sub) return null;
    return this.deactivate(sub.id);
  }

  async deleteById(id: string): Promise<void> {
    await prisma.subscription.delete({ where: { id } });
  }
}

export class RepositoryRepository {
  findByFullName(fullName: string) {
    return prisma.repository.findUnique({ where: { fullName } });
  }

  upsert(data: { fullName: string; owner: string; name: string; lastSeenTag?: string | null }) {
    return prisma.repository.upsert({
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

  updateLastSeenTag(id: string, tag: string) {
    return prisma.repository.update({
      where: { id },
      data: { lastSeenTag: tag, lastCheckedAt: new Date() },
    });
  }

  async updateLastCheckedAt(id: string): Promise<void> {
    await prisma.repository.update({
      where: { id },
      data: { lastCheckedAt: new Date() },
    });
  }

  findAllWithConfirmedSubscriptions() {
    return prisma.repository.findMany({
      where: {
        subscriptions: {
          some: { isActive: true, confirmedAt: { not: null } },
        },
      },
    });
  }
}
