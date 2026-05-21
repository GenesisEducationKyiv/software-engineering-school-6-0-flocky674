import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { GitHubService } from '../../src/modules/github/github.service';
import type { GitHubRepo } from '../../src/modules/github/github.client';
import { NotifierService } from '../../src/modules/notifier/notifier.service';
import prisma from '../../src/shared/db/prisma';

const githubRepo: GitHubRepo = {
  full_name: 'golang/go',
  description: 'The Go programming language',
  html_url: 'https://github.com/golang/go',
  stargazers_count: 0,
};

const verifyRepo = vi.fn();
const getLatestRelease = vi.fn();
const sendConfirmationEmail = vi.fn();
const sendReleaseNotification = vi.fn();

const githubService = {
  verifyRepo,
  getLatestRelease,
} as unknown as GitHubService;

const notifierService = {
  sendConfirmationEmail,
  sendReleaseNotification,
} as unknown as NotifierService;

async function resetDatabase() {
  await prisma.subscription.deleteMany();
  await prisma.repository.deleteMany();
}

async function createSubscription(overrides: {
  email?: string;
  fullName?: string;
  confirmToken?: string;
  unsubscribeToken?: string;
  isActive?: boolean;
  confirmedAt?: Date | null;
} = {}) {
  const fullName = overrides.fullName ?? 'golang/go';
  const [owner, name] = fullName.split('/');

  const repository = await prisma.repository.create({
    data: {
      fullName,
      owner,
      name,
      lastSeenTag: null,
    },
  });

  return prisma.subscription.create({
    data: {
      email: overrides.email ?? 'user@example.com',
      repositoryId: repository.id,
      confirmToken: overrides.confirmToken ?? 'confirm-token',
      unsubscribeToken: overrides.unsubscribeToken ?? 'unsubscribe-token',
      isActive: overrides.isActive ?? false,
      confirmedAt: overrides.confirmedAt ?? null,
    },
    include: {
      repository: true,
    },
  });
}

describe('subscription API integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ githubService, notifierService });
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();
    vi.clearAllMocks();
    verifyRepo.mockResolvedValue(githubRepo);
    getLatestRelease.mockResolvedValue(null);
    sendConfirmationEmail.mockResolvedValue(undefined);
    sendReleaseNotification.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /health returns service status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('POST /api/subscribe creates a pending subscription and sends confirmation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/subscribe',
      payload: {
        email: 'user@example.com',
        repo: 'golang/go',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: 'Confirmation email sent. Please check your inbox.',
    });

    const subscription = await prisma.subscription.findFirstOrThrow({
      include: {
        repository: true,
      },
    });

    expect(subscription.email).toBe('user@example.com');
    expect(subscription.isActive).toBe(false);
    expect(subscription.confirmedAt).toBeNull();
    expect(subscription.repository.fullName).toBe('golang/go');
    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: subscription.confirmToken,
      }),
    );
  });

  it('GET /api/confirm/:token confirms an existing subscription', async () => {
    await createSubscription({
      confirmToken: 'confirm-me',
      unsubscribeToken: 'unsubscribe-confirmed',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/confirm/confirm-me',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: 'Subscription confirmed successfully.',
    });

    const subscription = await prisma.subscription.findFirstOrThrow();
    expect(subscription.isActive).toBe(true);
    expect(subscription.confirmedAt).toBeInstanceOf(Date);
  });

  it('GET /api/unsubscribe/:token deactivates an active subscription', async () => {
    await createSubscription({
      confirmToken: 'confirm-active',
      unsubscribeToken: 'unsubscribe-me',
      isActive: true,
      confirmedAt: new Date(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/unsubscribe/unsubscribe-me',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: 'Successfully unsubscribed.',
    });

    const subscription = await prisma.subscription.findFirstOrThrow();
    expect(subscription.isActive).toBe(false);
  });

  it('GET /api/subscriptions returns active confirmed subscriptions by email', async () => {
    await createSubscription({
      email: 'user@example.com',
      confirmToken: 'confirm-listed',
      unsubscribeToken: 'unsubscribe-listed',
      isActive: true,
      confirmedAt: new Date(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/subscriptions?email=user@example.com',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        email: 'user@example.com',
        repo: 'golang/go',
        isActive: true,
        confirmedAt: expect.any(String),
        createdAt: expect.any(String),
      }),
    ]);
  });
});
