import { GitHubRelease, GitHubRepo } from './github.client';
import { GitHubApiPort, ReleaseProviderPort } from './github.ports';

export class GitHubService implements ReleaseProviderPort {
  constructor(private readonly client: GitHubApiPort) {}

  verifyRepo(owner: string, name: string): Promise<GitHubRepo> {
    return this.client.getRepo(owner, name);
  }

  getLatestRelease(owner: string, name: string): Promise<GitHubRelease | null> {
    return this.client.getLatestRelease(owner, name);
  }
}
