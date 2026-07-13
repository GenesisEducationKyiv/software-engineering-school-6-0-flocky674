import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../../config/env';
import { NotFoundError, RateLimitError, ServiceUnavailableError } from '../../shared/errors/app-error';
import logger from '../../shared/utils/logger';
import { GitHubApiPort } from './github.ports';

export interface GitHubClientOptions {
  apiBase: string;
  token?: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string;
}

export interface GitHubRepo {
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
}

export class GitHubClient implements GitHubApiPort {
  private readonly http: AxiosInstance;

  constructor(options: GitHubClientOptions = { apiBase: config.github.apiBase, token: config.github.token }) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    this.http = axios.create({
      baseURL: options.apiBase,
      headers,
      timeout: 10_000,
    });
  }

  async getRepo(owner: string, name: string): Promise<GitHubRepo> {
    try {
      const { data } = await this.http.get<GitHubRepo>(`/repos/${owner}/${name}`);
      return data;
    } catch (err) {
      this.handleError(err, `Repository ${owner}/${name} not found on GitHub`);
    }
  }

  async getLatestRelease(owner: string, name: string): Promise<GitHubRelease | null> {
    try {
      const { data } = await this.http.get<GitHubRelease>(
        `/repos/${owner}/${name}/releases/latest`,
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        return null;
      }
      this.handleError(err, `Failed to fetch releases for ${owner}/${name}`);
    }
  }

  private handleError(err: unknown, notFoundMessage: string): never {
    const axiosErr = err as AxiosError;

    if (!axiosErr.response) {
      logger.error({ err }, 'GitHub API network error');
      throw new ServiceUnavailableError('Cannot reach GitHub API');
    }

    const { status, headers } = axiosErr.response;

    if (status === 429) {
      const resetAt = headers['x-ratelimit-reset'];
      const remaining = headers['x-ratelimit-remaining'];
      logger.warn({ resetAt, remaining }, 'GitHub rate limit hit');
      throw new RateLimitError();
    }

    if (status === 404) {
      throw new NotFoundError(notFoundMessage);
    }

    logger.error({ status, err }, 'Unexpected GitHub API error');
    throw new ServiceUnavailableError(`GitHub API returned ${status}`);
  }
}

export const githubClient = new GitHubClient();
