import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const sendConfirmationEmail = vi.fn();
const sendReleaseNotification = vi.fn();

vi.mock('../src/notifier/notifier.service', () => ({
  NotifierService: vi.fn(() => ({
    sendConfirmationEmail,
    sendReleaseNotification,
  })),
}));

describe('email routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import('../src/app');
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts confirmation email requests', async () => {
    sendConfirmationEmail.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/api/emails/confirmation',
      payload: {
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token',
        appUrl: 'http://localhost:3000',
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: 'accepted' });
    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        repoFullName: 'golang/go',
      }),
    );
  });

  it('rejects invalid payloads', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/emails/confirmation',
      payload: {
        email: 'invalid-email',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
