import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../../src/modules/subscriptions/subscription.service';
import {
  SubscriptionRepository,
  RepositoryRepository,
} from '../../src/modules/subscriptions/subscription.repository';
import { GitHubService } from '../../src/modules/github/github.service';
import { NotifierService } from '../../src/modules/notifier/notifier.service';
import { BadRequestError, ConflictError, NotFoundError } from '../../src/shared/errors/app-error';

function makeRepo(overrides = {}) {
  return {
    id: 'repo-1',
    fullName: 'golang/go',
    owner: 'golang',
    name: 'go',
    lastSeenTag: null,
    lastCheckedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSub(overrides = {}) {
  return {
    id: 'sub-1',
    email: 'user@example.com',
    repositoryId: 'repo-1',
    isActive: false,
    confirmedAt: null,
    confirmToken: 'confirm-token-abc',
    unsubscribeToken: 'unsub-token-xyz',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMocks() {
  const subscriptionRepo = {
    findById: vi.fn(),
    findByEmailAndRepo: vi.fn(),
    findByConfirmToken: vi.fn(),
    findByUnsubscribeToken: vi.fn(),
    findActiveByEmail: vi.fn(),
    findConfirmedByRepositoryId: vi.fn(),
    create: vi.fn(),
    confirm: vi.fn(),
    deactivate: vi.fn(),
    deactivateByUnsubscribeToken: vi.fn(),
  } as unknown as SubscriptionRepository;

  const repositoryRepo = {
    findByFullName: vi.fn(),
    upsert: vi.fn(),
    updateLastSeenTag: vi.fn(),
    updateLastCheckedAt: vi.fn(),
    findAllWithConfirmedSubscriptions: vi.fn(),
  } as unknown as RepositoryRepository;

  const githubService = {
    verifyRepo: vi.fn(),
    getLatestRelease: vi.fn(),
  } as unknown as GitHubService;

  const notifierService = {
    sendConfirmationEmail: vi.fn(),
    sendReleaseNotification: vi.fn(),
  } as unknown as NotifierService;

  return { subscriptionRepo, repositoryRepo, githubService, notifierService };
}

describe('SubscriptionService.subscribe', () => {
  let service: SubscriptionService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
    service = new SubscriptionService(
      mocks.subscriptionRepo,
      mocks.repositoryRepo,
      mocks.githubService,
      mocks.notifierService,
    );
  });

  it('creates subscription and sends confirmation email', async () => {
    const repo = makeRepo();
    const sub = makeSub();

    vi.mocked(mocks.githubService.verifyRepo).mockResolvedValue({} as any);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(null);
    vi.mocked(mocks.repositoryRepo.upsert).mockResolvedValue(repo as any);
    vi.mocked(mocks.subscriptionRepo.findByEmailAndRepo).mockResolvedValue(null);
    vi.mocked(mocks.subscriptionRepo.create).mockResolvedValue(sub as any);

    await service.subscribe({ email: 'user@example.com', repo: 'golang/go' });

    expect(mocks.subscriptionRepo.create).toHaveBeenCalledOnce();
    expect(mocks.notifierService.sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token-abc',
      }),
    );
  });

  it('resends confirmation email if subscription exists but not confirmed', async () => {
    const repo = makeRepo();
    const existing = makeSub({ confirmedAt: null, isActive: false });

    vi.mocked(mocks.githubService.verifyRepo).mockResolvedValue({} as any);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(null);
    vi.mocked(mocks.repositoryRepo.upsert).mockResolvedValue(repo as any);
    vi.mocked(mocks.subscriptionRepo.findByEmailAndRepo).mockResolvedValue(existing as any);

    await service.subscribe({ email: 'user@example.com', repo: 'golang/go' });

    expect(mocks.subscriptionRepo.create).not.toHaveBeenCalled();
    expect(mocks.notifierService.sendConfirmationEmail).toHaveBeenCalledOnce();
  });

  it('throws 409 if already subscribed and confirmed', async () => {
    const repo = makeRepo();
    const existing = makeSub({ isActive: true, confirmedAt: new Date() });

    vi.mocked(mocks.githubService.verifyRepo).mockResolvedValue({} as any);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(null);
    vi.mocked(mocks.repositoryRepo.upsert).mockResolvedValue(repo as any);
    vi.mocked(mocks.subscriptionRepo.findByEmailAndRepo).mockResolvedValue(existing as any);

    await expect(
      service.subscribe({ email: 'user@example.com', repo: 'golang/go' }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws 400 for invalid repo format', async () => {
    await expect(
      service.subscribe({ email: 'user@example.com', repo: 'badformat' }),
    ).rejects.toThrow(BadRequestError);
    expect(mocks.githubService.verifyRepo).not.toHaveBeenCalled();
  });

  it('throws 400 for invalid email', async () => {
    await expect(
      service.subscribe({ email: 'not-an-email', repo: 'golang/go' }),
    ).rejects.toThrow(BadRequestError);
  });

  it('throws 404 if repo does not exist on GitHub', async () => {
    vi.mocked(mocks.githubService.verifyRepo).mockRejectedValue(
      new NotFoundError('Repository not found'),
    );
    await expect(
      service.subscribe({ email: 'user@example.com', repo: 'golang/nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('SubscriptionService.confirm', () => {
  let service: SubscriptionService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
    service = new SubscriptionService(
      mocks.subscriptionRepo,
      mocks.repositoryRepo,
      mocks.githubService,
      mocks.notifierService,
    );
  });

  it('confirms subscription with valid token', async () => {
    const sub = makeSub({ confirmedAt: null });
    vi.mocked(mocks.subscriptionRepo.findByConfirmToken).mockResolvedValue(sub as any);
    vi.mocked(mocks.subscriptionRepo.confirm).mockResolvedValue({ ...sub, isActive: true, confirmedAt: new Date() } as any);

    await expect(service.confirm('confirm-token-abc')).resolves.not.toThrow();
    expect(mocks.subscriptionRepo.confirm).toHaveBeenCalledWith('sub-1');
  });

  it('throws 404 for invalid confirm token', async () => {
    vi.mocked(mocks.subscriptionRepo.findByConfirmToken).mockResolvedValue(null);
    await expect(service.confirm('bad-token')).rejects.toThrow(NotFoundError);
  });

  it('is idempotent if already confirmed', async () => {
    const sub = makeSub({ confirmedAt: new Date() });
    vi.mocked(mocks.subscriptionRepo.findByConfirmToken).mockResolvedValue(sub as any);

    await expect(service.confirm('confirm-token-abc')).resolves.not.toThrow();
    expect(mocks.subscriptionRepo.confirm).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService.unsubscribe', () => {
  let service: SubscriptionService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
    service = new SubscriptionService(
      mocks.subscriptionRepo,
      mocks.repositoryRepo,
      mocks.githubService,
      mocks.notifierService,
    );
  });

  it('unsubscribes with valid token', async () => {
    const sub = makeSub();
    vi.mocked(mocks.subscriptionRepo.deactivateByUnsubscribeToken).mockResolvedValue(sub as any);
    await expect(service.unsubscribe('unsub-token-xyz')).resolves.not.toThrow();
  });

  it('throws 404 for invalid unsubscribe token', async () => {
    vi.mocked(mocks.subscriptionRepo.deactivateByUnsubscribeToken).mockResolvedValue(null);
    await expect(service.unsubscribe('bad-token')).rejects.toThrow(NotFoundError);
  });
});

describe('SubscriptionService.getSubscriptionsByEmail', () => {
  let service: SubscriptionService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
    service = new SubscriptionService(
      mocks.subscriptionRepo,
      mocks.repositoryRepo,
      mocks.githubService,
      mocks.notifierService,
    );
  });

  it('returns active confirmed subscriptions for email', async () => {
    const repo = makeRepo();
    const sub = { ...makeSub({ isActive: true, confirmedAt: new Date() }), repository: repo };
    vi.mocked(mocks.subscriptionRepo.findActiveByEmail).mockResolvedValue([sub as any]);

    const result = await service.getSubscriptionsByEmail('user@example.com');

    expect(result).toHaveLength(1);
    expect(result[0].repo).toBe('golang/go');
    expect(result[0].isActive).toBe(true);
  });

  it('throws 400 if email is empty', async () => {
    await expect(service.getSubscriptionsByEmail('')).rejects.toThrow(BadRequestError);
  });

  it('returns empty array when no subscriptions found', async () => {
    vi.mocked(mocks.subscriptionRepo.findActiveByEmail).mockResolvedValue([]);
    const result = await service.getSubscriptionsByEmail('nobody@example.com');
    expect(result).toEqual([]);
  });
});
