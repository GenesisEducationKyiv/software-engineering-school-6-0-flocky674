import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const channel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockReturnValue(true),
  createChannel: vi.fn(),
};

const connection = {
  createChannel: vi.fn().mockResolvedValue(channel),
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn().mockResolvedValue(connection),
  },
}));

describe('NotifierPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.assertExchange.mockResolvedValue(undefined);
    channel.publish.mockReturnValue(true);
    connection.createChannel.mockResolvedValue(channel);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('publishes a confirmation command with the correct routing key and payload', async () => {
    const { NotifierPublisher } = await import('../../src/modules/notifier/notifier.publisher');
    const publisher = new NotifierPublisher();

    await publisher.sendConfirmationEmail({
      email: 'user@example.com',
      repoFullName: 'golang/go',
      confirmToken: 'confirm-token',
    });

    expect(channel.assertExchange).toHaveBeenCalledWith('notifications', 'topic', { durable: true });
    expect(channel.publish).toHaveBeenCalledOnce();

    const [exchange, routingKey, content, options] = channel.publish.mock.calls[0];
    expect(exchange).toBe('notifications');
    expect(routingKey).toBe('email.confirmation');
    expect(options).toMatchObject({ persistent: true, contentType: 'application/json' });

    const message = JSON.parse((content as Buffer).toString());
    expect(message).toEqual({
      type: 'email.confirmation',
      data: {
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token',
        appUrl: expect.any(String),
      },
    });
  });

  it('publishes a release command with the correct routing key', async () => {
    const { NotifierPublisher } = await import('../../src/modules/notifier/notifier.publisher');
    const publisher = new NotifierPublisher();

    await publisher.sendReleaseNotification({
      email: 'user@example.com',
      repoFullName: 'golang/go',
      tagName: 'v1.2.3',
      releaseName: 'Release v1.2.3',
      releaseUrl: 'https://github.com/golang/go/releases/tag/v1.2.3',
      unsubscribeToken: 'unsubscribe-token',
    });

    const [, routingKey, content] = channel.publish.mock.calls[0];
    expect(routingKey).toBe('email.release');

    const message = JSON.parse((content as Buffer).toString());
    expect(message.type).toBe('email.release');
    expect(message.data.tagName).toBe('v1.2.3');
  });
});
