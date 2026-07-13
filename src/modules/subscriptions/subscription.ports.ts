import { Subscription, Repository } from '@prisma/client';

export type SubscriptionWithRepo = Subscription & { repository: Repository };

export interface CreateSubscriptionData {
  email: string;
  repositoryId: string;
}

export interface UpsertRepositoryData {
  fullName: string;
  owner: string;
  name: string;
  lastSeenTag?: string | null;
}

/**
 * Persistence boundary for subscriptions. Services depend on this abstraction
 * (DIP) instead of a concrete Prisma-backed class.
 */
export interface SubscriptionRepositoryPort {
  findById(id: string): Promise<SubscriptionWithRepo | null>;
  findByEmailAndRepo(email: string, repositoryId: string): Promise<Subscription | null>;
  findByConfirmToken(token: string): Promise<Subscription | null>;
  findByUnsubscribeToken(token: string): Promise<Subscription | null>;
  findActiveByEmail(email: string): Promise<SubscriptionWithRepo[]>;
  findConfirmedByRepositoryId(repositoryId: string): Promise<Subscription[]>;
  create(data: CreateSubscriptionData): Promise<Subscription>;
  confirm(id: string): Promise<Subscription>;
  deactivate(id: string): Promise<Subscription>;
  deactivateByUnsubscribeToken(token: string): Promise<Subscription | null>;
}

/**
 * Persistence boundary for tracked repositories.
 */
export interface RepositoryRepositoryPort {
  findByFullName(fullName: string): Promise<Repository | null>;
  upsert(data: UpsertRepositoryData): Promise<Repository>;
  updateLastSeenTag(id: string, tag: string): Promise<Repository>;
  updateLastCheckedAt(id: string): Promise<void>;
  findAllWithConfirmedSubscriptions(): Promise<Repository[]>;
}
