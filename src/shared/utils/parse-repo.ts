import { BadRequestError } from '../errors/app-error';

export interface RepoParts {
  owner: string;
  name: string;
  fullName: string;
}

export function parseRepo(repo: string): RepoParts {
  if (!repo || typeof repo !== 'string') {
    throw new BadRequestError('Repository parameter is required');
  }

  const parts = repo.split('/');

  if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') {
    throw new BadRequestError(
      'Invalid repository format. Expected "owner/repo" (e.g. golang/go)',
    );
  }

  const [owner, name] = parts.map((p) => p.trim());

  const validPattern = /^[a-zA-Z0-9._-]+$/;
  if (!validPattern.test(owner) || !validPattern.test(name)) {
    throw new BadRequestError(
      'Repository owner and name must contain only alphanumeric characters, hyphens, underscores, or dots',
    );
  }

  return { owner, name, fullName: `${owner}/${name}` };
}
