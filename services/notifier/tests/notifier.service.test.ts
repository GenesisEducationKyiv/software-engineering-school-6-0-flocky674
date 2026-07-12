import { beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { NotifierService } from '../src/notifier/notifier.service';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

describe('NotifierService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue(undefined);
  });

  it('sends a confirmation email', async () => {
    const service = new NotifierService();

    await service.sendConfirmationEmail({
      email: 'user@example.com',
      repoFullName: 'golang/go',
      confirmToken: 'confirm-token',
      appUrl: 'http://localhost:3000',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Confirm your subscription to golang/go',
        text: expect.stringContaining('http://localhost:3000/api/confirm/confirm-token'),
      }),
    );
  });

  it('sends a release notification email', async () => {
    const service = new NotifierService();

    await service.sendReleaseNotification({
      email: 'user@example.com',
      repoFullName: 'golang/go',
      tagName: 'v1.2.3',
      releaseName: 'Release v1.2.3',
      releaseUrl: 'https://github.com/golang/go/releases/tag/v1.2.3',
      unsubscribeToken: 'unsubscribe-token',
      appUrl: 'http://localhost:3000',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'New release in golang/go: v1.2.3',
        text: expect.stringContaining('http://localhost:3000/api/unsubscribe/unsubscribe-token'),
      }),
    );
  });
});
