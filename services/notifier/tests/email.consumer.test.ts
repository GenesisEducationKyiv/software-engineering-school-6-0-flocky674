import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleEmailMessage, startEmailConsumer } from '../src/messaging/email.consumer';
import {
  EMAIL_CONFIRMATION_ROUTING_KEY,
  EMAIL_RELEASE_ROUTING_KEY,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_QUEUE,
} from '../src/messaging/contract';
import type { NotifierService } from '../src/notifier/notifier.service';

function makeNotifierService() {
  return {
    sendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
    sendReleaseNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotifierService;
}

function encode(payload: unknown): Buffer {
  return Buffer.from(JSON.stringify(payload));
}

describe('handleEmailMessage', () => {
  let notifierService: ReturnType<typeof makeNotifierService>;

  beforeEach(() => {
    notifierService = makeNotifierService();
  });

  it('sends a confirmation email and acks for a valid confirmation message', async () => {
    const message = {
      type: EMAIL_CONFIRMATION_ROUTING_KEY,
      data: {
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token',
        appUrl: 'http://localhost:3000',
      },
    };

    const result = await handleEmailMessage(encode(message), notifierService);

    expect(result).toBe('ack');
    expect(notifierService.sendConfirmationEmail).toHaveBeenCalledWith(message.data);
    expect(notifierService.sendReleaseNotification).not.toHaveBeenCalled();
  });

  it('sends a release email and acks for a valid release message', async () => {
    const message = {
      type: EMAIL_RELEASE_ROUTING_KEY,
      data: {
        email: 'user@example.com',
        repoFullName: 'golang/go',
        tagName: 'v1.2.3',
        releaseName: 'Release v1.2.3',
        releaseUrl: 'https://github.com/golang/go/releases/tag/v1.2.3',
        unsubscribeToken: 'unsubscribe-token',
        appUrl: 'http://localhost:3000',
      },
    };

    const result = await handleEmailMessage(encode(message), notifierService);

    expect(result).toBe('ack');
    expect(notifierService.sendReleaseNotification).toHaveBeenCalledWith(message.data);
  });

  it('drops non-JSON messages without calling the service', async () => {
    const result = await handleEmailMessage(Buffer.from('not-json'), notifierService);

    expect(result).toBe('drop');
    expect(notifierService.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(notifierService.sendReleaseNotification).not.toHaveBeenCalled();
  });

  it('drops messages that fail schema validation', async () => {
    const result = await handleEmailMessage(
      encode({ type: EMAIL_CONFIRMATION_ROUTING_KEY, data: { email: 'invalid' } }),
      notifierService,
    );

    expect(result).toBe('drop');
    expect(notifierService.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it('drops messages with an unknown type', async () => {
    const result = await handleEmailMessage(
      encode({ type: 'email.unknown', data: {} }),
      notifierService,
    );

    expect(result).toBe('drop');
  });

  it('requeues when the notifier service throws a transient error', async () => {
    vi.mocked(notifierService.sendConfirmationEmail).mockRejectedValueOnce(new Error('SMTP down'));

    const result = await handleEmailMessage(
      encode({
        type: EMAIL_CONFIRMATION_ROUTING_KEY,
        data: {
          email: 'user@example.com',
          repoFullName: 'golang/go',
          confirmToken: 'confirm-token',
          appUrl: 'http://localhost:3000',
        },
      }),
      notifierService,
    );

    expect(result).toBe('requeue');
  });
});

describe('startEmailConsumer', () => {
  it('asserts topology and acks successfully handled messages', async () => {
    const notifierService = makeNotifierService();
    let onMessage: ((msg: unknown) => Promise<void>) | undefined;

    const channel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
      prefetch: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn().mockImplementation((_queue: string, handler: (msg: unknown) => Promise<void>) => {
        onMessage = handler;
        return Promise.resolve({ consumerTag: 'test' });
      }),
      ack: vi.fn(),
      nack: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startEmailConsumer(channel as any, notifierService);

    expect(channel.assertExchange).toHaveBeenCalledWith(NOTIFICATIONS_EXCHANGE, 'topic', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith(NOTIFICATIONS_QUEUE, { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledWith(NOTIFICATIONS_QUEUE, NOTIFICATIONS_EXCHANGE, 'email.*');

    const msg = {
      content: Buffer.from(
        JSON.stringify({
          type: EMAIL_CONFIRMATION_ROUTING_KEY,
          data: {
            email: 'user@example.com',
            repoFullName: 'golang/go',
            confirmToken: 'confirm-token',
            appUrl: 'http://localhost:3000',
          },
        }),
      ),
    };

    await onMessage?.(msg);

    expect(notifierService.sendConfirmationEmail).toHaveBeenCalledOnce();
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });
});
