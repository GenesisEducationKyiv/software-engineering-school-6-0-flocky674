import { describe, it, expect } from 'vitest';
import { EmailAddress } from '../../src/modules/subscriptions/email';
import { BadRequestError } from '../../src/shared/errors/app-error';

describe('EmailAddress', () => {
  it('creates a value object for a valid email', () => {
    const email = EmailAddress.create('user@example.com');
    expect(email.value).toBe('user@example.com');
    expect(email.toString()).toBe('user@example.com');
  });

  it('throws BadRequestError for an invalid email', () => {
    expect(() => EmailAddress.create('not-an-email')).toThrow(BadRequestError);
  });

  it('throws BadRequestError for an empty email', () => {
    expect(() => EmailAddress.create('')).toThrow(BadRequestError);
  });

  it('reports validity without throwing', () => {
    expect(EmailAddress.isValid('user@example.com')).toBe(true);
    expect(EmailAddress.isValid('bad')).toBe(false);
    expect(EmailAddress.isValid('')).toBe(false);
  });
});
