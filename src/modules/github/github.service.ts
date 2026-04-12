import { GitHubClient, GitHubRelease, GitHubRepo } from './github.client';

export class GitHubService {
  constructor(private readonly client: GitHubClient) {}

  verifyRepo(owner: string, name: string): Promise<GitHubRepo> {
    return this.client.getRepo(owner, name);
  }

  getLatestRelease(owner: string, name: string): Promise<GitHubRelease | null> {
    return this.client.getLatestRelease(owner, name);
  }
}
