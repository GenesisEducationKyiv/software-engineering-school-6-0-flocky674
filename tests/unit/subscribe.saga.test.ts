import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Subscription } from '@prisma/client';
import {
  SubscriptionConfirmationSaga,
  SubscriptionSagaRepository,
} from '../../src/modules/subscriptions/subscribe.saga';
import { NotifierPort } from '../../src/modules/notifier/notifier.types';

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    email: 'user@example.com',
    repositoryId: 'repo-1',
    isActive: false,
    confirmedAt: null,
    confirmToken: 'confirm-token',
    unsubscribeToken: 'unsub-token',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subscription;
}

describe('SubscriptionConfirmationSaga', () => {
  let repo: { create: ReturnType<typeof vi.fn>; deleteById: ReturnType<typeof vi.fn> };
  let notifier: { sendConfirmationEmail: ReturnType<typeof vi.fn>; sendReleaseNotification: ReturnType<typeof vi.fn> };
  let saga: SubscriptionConfirmationSaga;

  const input = {
    email: 'user@example.com',
    repositoryId: 'repo-1',
    repoFullName: 'golang/go',
  };

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(makeSubscription()),
      deleteById: vi.fn().mockResolvedValue(undefined),
    };
    notifier = {
      sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
      sendReleaseNotification: vi.fn().mockResolvedValue(undefined),
    };
    saga = new SubscriptionConfirmationSaga(
      repo as unknown as SubscriptionSagaRepository,
      notifier as unknown as NotifierPort,
    );
  });

  it('creates the subscription then sends the confirmation email', async () => {
    await saga.run(input);

    expect(repo.create).toHaveBeenCalledWith({ email: 'user@example.com', repositoryId: 'repo-1' });
    expect(notifier.sendConfirmationEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      repoFullName: 'golang/go',
      confirmToken: 'confirm-token',
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('compensates by deleting the subscription when the email step fails', async () => {
    notifier.sendConfirmationEmail.mockRejectedValueOnce(new Error('broker down'));

    await expect(saga.run(input)).rejects.toThrow('broker down');

    expect(repo.create).toHaveBeenCalledOnce();
    expect(repo.deleteById).toHaveBeenCalledWith('sub-1');
  });

  it('propagates the create failure without compensating (nothing was created)', async () => {
    repo.create.mockRejectedValueOnce(new Error('db down'));

    await expect(saga.run(input)).rejects.toThrow('db down');

    expect(notifier.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
