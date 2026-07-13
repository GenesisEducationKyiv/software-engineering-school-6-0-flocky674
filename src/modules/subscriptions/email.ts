import { BadRequestError } from '../../shared/errors/app-error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Value object that guarantees a syntactically valid email address.
 * Centralises email validation (GRASP: Information Expert / Pure Fabrication)
 * so services no longer embed validation rules (SRP).
 */
export class EmailAddress {
  private constructor(public readonly value: string) {}

  static create(value: string): EmailAddress {
    if (!value || !EMAIL_PATTERN.test(value)) {
      throw new BadRequestError('Invalid email address');
    }
    return new EmailAddress(value);
  }

  static isValid(value: string): boolean {
    return Boolean(value) && EMAIL_PATTERN.test(value);
  }

  toString(): string {
    return this.value;
  }
}
