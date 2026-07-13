import { describe, it, expect } from 'vitest';
import { toSubscriptionResponse } from '../../src/modules/subscriptions/subscription.mapper';
import type { SubscriptionWithRepo } from '../../src/modules/subscriptions/subscription.ports';

describe('toSubscriptionResponse', () => {
  it('maps a subscription entity to the API DTO', () => {
    const confirmedAt = new Date('2026-01-02T03:04:05.000Z');
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    const entity = {
      id: 'sub-1',
      email: 'user@example.com',
      repositoryId: 'repo-1',
      isActive: true,
      confirmedAt,
      confirmToken: 'c',
      unsubscribeToken: 'u',
      createdAt,
      updatedAt: createdAt,
      repository: {
        id: 'repo-1',
        fullName: 'golang/go',
        owner: 'golang',
        name: 'go',
        lastSeenTag: null,
        lastCheckedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    } as unknown as SubscriptionWithRepo;

    expect(toSubscriptionResponse(entity)).toEqual({
      id: 'sub-1',
      email: 'user@example.com',
      repo: 'golang/go',
      isActive: true,
      confirmedAt: confirmedAt.toISOString(),
      createdAt: createdAt.toISOString(),
    });
  });

  it('maps a null confirmedAt to null', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const entity = {
      id: 'sub-2',
      email: 'user@example.com',
      isActive: false,
      confirmedAt: null,
      createdAt,
      repository: { fullName: 'golang/go' },
    } as unknown as SubscriptionWithRepo;

    expect(toSubscriptionResponse(entity).confirmedAt).toBeNull();
  });
});
