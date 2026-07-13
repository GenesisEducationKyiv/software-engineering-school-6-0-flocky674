import { GitHubRelease, GitHubRepo } from './github.client';

/**
 * Low-level GitHub HTTP API boundary implemented by the concrete client.
 * Lets GitHubService depend on an abstraction rather than axios details.
 */
export interface GitHubApiPort {
  getRepo(owner: string, name: string): Promise<GitHubRepo>;
  getLatestRelease(owner: string, name: string): Promise<GitHubRelease | null>;
}

/**
 * Domain-facing boundary consumed by application services. Exposes only the
 * release-related operations the domain actually needs (ISP).
 */
export interface ReleaseProviderPort {
  verifyRepo(owner: string, name: string): Promise<GitHubRepo>;
  getLatestRelease(owner: string, name: string): Promise<GitHubRelease | null>;
}
