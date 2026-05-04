import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Repository, Subscription } from '@prisma/client';
import { ScannerService } from '../../src/modules/scanner/scanner.service';
import {
  RepositoryRepository,
  SubscriptionRepository,
} from '../../src/modules/subscriptions/subscription.repository';
import { GitHubService } from '../../src/modules/github/github.service';
import type { GitHubRelease } from '../../src/modules/github/github.client';
import { NotifierService } from '../../src/modules/notifier/notifier.service';
import { RateLimitError } from '../../src/shared/errors/app-error';

function makeRepo(overrides = {}) {
  return {
    id: 'repo-1',
    fullName: 'golang/go',
    owner: 'golang',
    name: 'go',
    lastSeenTag: 'v1.0.0',
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
    isActive: true,
    confirmedAt: new Date(),
    confirmToken: 'confirm-token',
    unsubscribeToken: 'unsub-token',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRelease(tagName: string): GitHubRelease {
  return {
    tag_name: tagName,
    name: `Release ${tagName}`,
    html_url: `https://github.com/golang/go/releases/tag/${tagName}`,
    published_at: new Date().toISOString(),
    body: '',
  };
}

function makeMocks() {
  const repositoryRepo = {
    findAllWithConfirmedSubscriptions: vi.fn(),
    updateLastSeenTag: vi.fn(),
    updateLastCheckedAt: vi.fn(),
  } as unknown as RepositoryRepository;

  const subscriptionRepo = {
    findConfirmedByRepositoryId: vi.fn(),
  } as unknown as SubscriptionRepository;

  const githubService = {
    getLatestRelease: vi.fn(),
  } as unknown as GitHubService;

  const notifierService = {
    sendReleaseNotification: vi.fn(),
    sendConfirmationEmail: vi.fn(),
  } as unknown as NotifierService;

  return { repositoryRepo, subscriptionRepo, githubService, notifierService };
}

describe('ScannerService.scan', () => {
  let service: ScannerService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    mocks = makeMocks();
    service = new ScannerService(
      mocks.repositoryRepo,
      mocks.subscriptionRepo,
      mocks.githubService,
      mocks.notifierService,
    );
  });

  it('sends notification when new release is detected', async () => {
    const repo = makeRepo({ lastSeenTag: 'v1.0.0' });
    const sub = makeSub();

    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([repo as Repository]);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(makeRelease('v1.1.0'));
    vi.mocked(mocks.subscriptionRepo.findConfirmedByRepositoryId).mockResolvedValue([sub as Subscription]);
    vi.mocked(mocks.repositoryRepo.updateLastSeenTag).mockResolvedValue(repo as Repository);
    vi.mocked(mocks.repositoryRepo.updateLastCheckedAt).mockResolvedValue();

    await service.scan();

    expect(mocks.notifierService.sendReleaseNotification).toHaveBeenCalledOnce();
    expect(mocks.notifierService.sendReleaseNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        repoFullName: 'golang/go',
        tagName: 'v1.1.0',
      }),
    );
    expect(mocks.repositoryRepo.updateLastSeenTag).toHaveBeenCalledWith('repo-1', 'v1.1.0');
  });

  it('does not notify when tag has not changed', async () => {
    const repo = makeRepo({ lastSeenTag: 'v1.0.0' });

    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([repo as Repository]);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(makeRelease('v1.0.0'));
    vi.mocked(mocks.repositoryRepo.updateLastCheckedAt).mockResolvedValue();

    await service.scan();

    expect(mocks.notifierService.sendReleaseNotification).not.toHaveBeenCalled();
    expect(mocks.repositoryRepo.updateLastSeenTag).not.toHaveBeenCalled();
  });

  it('does not notify when repo has no releases', async () => {
    const repo = makeRepo({ lastSeenTag: null });

    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([repo as Repository]);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(null);
    vi.mocked(mocks.repositoryRepo.updateLastCheckedAt).mockResolvedValue();

    await service.scan();

    expect(mocks.notifierService.sendReleaseNotification).not.toHaveBeenCalled();
  });

  it('records initial tag without notifying (lastSeenTag is null)', async () => {
    const repo = makeRepo({ lastSeenTag: null });

    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([repo as Repository]);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(makeRelease('v1.0.0'));
    vi.mocked(mocks.repositoryRepo.updateLastSeenTag).mockResolvedValue(repo as Repository);
    vi.mocked(mocks.repositoryRepo.updateLastCheckedAt).mockResolvedValue();

    await service.scan();

    expect(mocks.repositoryRepo.updateLastSeenTag).toHaveBeenCalledWith('repo-1', 'v1.0.0');
    expect(mocks.notifierService.sendReleaseNotification).not.toHaveBeenCalled();
  });

  it('throws RateLimitError and stops the cycle on GitHub 429', async () => {
    const repo = makeRepo();

    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([repo as Repository]);
    vi.mocked(mocks.githubService.getLatestRelease).mockRejectedValue(new RateLimitError());
    vi.mocked(mocks.repositoryRepo.updateLastCheckedAt).mockResolvedValue();

    await expect(service.scan()).rejects.toThrow(RateLimitError);
    expect(mocks.notifierService.sendReleaseNotification).not.toHaveBeenCalled();
  });

  it('continues with remaining subscribers if one email fails', async () => {
    const repo = makeRepo({ lastSeenTag: 'v1.0.0' });
    const sub1 = makeSub({ id: 'sub-1', email: 'a@example.com' });
    const sub2 = makeSub({ id: 'sub-2', email: 'b@example.com' });

    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([repo as Repository]);
    vi.mocked(mocks.githubService.getLatestRelease).mockResolvedValue(makeRelease('v2.0.0'));
    vi.mocked(mocks.subscriptionRepo.findConfirmedByRepositoryId).mockResolvedValue([
      sub1 as Subscription,
      sub2 as Subscription,
    ]);
    vi.mocked(mocks.repositoryRepo.updateLastSeenTag).mockResolvedValue(repo as Repository);
    vi.mocked(mocks.repositoryRepo.updateLastCheckedAt).mockResolvedValue();

    vi.mocked(mocks.notifierService.sendReleaseNotification)
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    await service.scan();

    expect(mocks.notifierService.sendReleaseNotification).toHaveBeenCalledTimes(2);
  });

  it('does nothing when there are no repos with confirmed subscriptions', async () => {
    vi.mocked(mocks.repositoryRepo.findAllWithConfirmedSubscriptions).mockResolvedValue([]);

    await service.scan();

    expect(mocks.githubService.getLatestRelease).not.toHaveBeenCalled();
  });
});
