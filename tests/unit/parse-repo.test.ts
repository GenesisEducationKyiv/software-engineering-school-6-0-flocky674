import { describe, it, expect } from 'vitest';
import { parseRepo } from '../../src/shared/utils/parse-repo';
import { BadRequestError } from '../../src/shared/errors/app-error';

describe('parseRepo', () => {
  it('correctly parses a valid owner/repo string', () => {
    const result = parseRepo('golang/go');
    expect(result).toEqual({ owner: 'golang', name: 'go', fullName: 'golang/go' });
  });

  it('handles repos with hyphens and dots', () => {
    const result = parseRepo('facebook/react-native');
    expect(result.owner).toBe('facebook');
    expect(result.name).toBe('react-native');
  });

  it('throws 400 for missing slash', () => {
    expect(() => parseRepo('golang')).toThrow(BadRequestError);
    expect(() => parseRepo('golang')).toThrow('Invalid repository format');
  });

  it('throws 400 for leading slash', () => {
    expect(() => parseRepo('/go')).toThrow(BadRequestError);
  });

  it('throws 400 for trailing slash', () => {
    expect(() => parseRepo('golang/')).toThrow(BadRequestError);
  });

  it('throws 400 for multiple slashes', () => {
    expect(() => parseRepo('golang/go/extra')).toThrow(BadRequestError);
  });

  it('throws 400 for empty string', () => {
    expect(() => parseRepo('')).toThrow(BadRequestError);
  });

  it('throws 400 for only slashes', () => {
    expect(() => parseRepo('/')).toThrow(BadRequestError);
  });

  it('throws 400 for whitespace-only segments', () => {
    expect(() => parseRepo(' / ')).toThrow(BadRequestError);
  });
});
