import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { createMailServiceHandlers } from '../src/grpc/mail.grpc.server';
import type { NotifierService } from '../src/notifier/notifier.service';

function makeNotifier() {
  return {
    sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
    sendReleaseNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotifierService;
}

const validConfirmation = {
  email: 'user@example.com',
  repoFullName: 'golang/go',
  confirmToken: 'confirm-token',
  appUrl: 'http://localhost:3000',
};

describe('MailVerificationService gRPC handlers', () => {
  let notifier: ReturnType<typeof makeNotifier>;
  let handlers: ReturnType<typeof createMailServiceHandlers>;

  beforeEach(() => {
    notifier = makeNotifier();
    handlers = createMailServiceHandlers(notifier);
  });

  it('sends the confirmation email and returns accepted', async () => {
    const callback = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (handlers.sendConfirmationEmail as any)({ request: validConfirmation }, callback);

    expect(notifier.sendConfirmationEmail).toHaveBeenCalledWith(validConfirmation);
    expect(callback).toHaveBeenCalledWith(null, { accepted: true });
  });

  it('returns INVALID_ARGUMENT when a required field is missing', async () => {
    const callback = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (handlers.sendConfirmationEmail as any)(
      { request: { ...validConfirmation, email: '' } },
      callback,
    );

    expect(notifier.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpc.status.INVALID_ARGUMENT }),
    );
  });

  it('returns INTERNAL when delivery fails', async () => {
    vi.mocked(notifier.sendConfirmationEmail).mockRejectedValueOnce(new Error('smtp down'));
    const callback = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (handlers.sendConfirmationEmail as any)({ request: validConfirmation }, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpc.status.INTERNAL }),
    );
  });
});
