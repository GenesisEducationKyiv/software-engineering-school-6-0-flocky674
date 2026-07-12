import { Channel, ConsumeMessage } from 'amqplib';
import { z } from 'zod';
import { NotifierService } from '../notifier/notifier.service';
import logger from '../shared/utils/logger';
import {
  EMAIL_CONFIRMATION_ROUTING_KEY,
  EMAIL_RELEASE_ROUTING_KEY,
  EMAIL_ROUTING_PATTERN,
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_QUEUE,
} from './contract';

const confirmationDataSchema = z.object({
  email: z.string().email(),
  repoFullName: z.string().min(1),
  confirmToken: z.string().min(1),
  appUrl: z.string().url(),
});

const releaseDataSchema = z.object({
  email: z.string().email(),
  repoFullName: z.string().min(1),
  tagName: z.string().min(1),
  releaseName: z.string(),
  releaseUrl: z.string().url(),
  unsubscribeToken: z.string().min(1),
  appUrl: z.string().url(),
});

const envelopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(EMAIL_CONFIRMATION_ROUTING_KEY), data: confirmationDataSchema }),
  z.object({ type: z.literal(EMAIL_RELEASE_ROUTING_KEY), data: releaseDataSchema }),
]);

export type HandleResult = 'ack' | 'drop' | 'requeue';

export async function handleEmailMessage(
  content: Buffer,
  notifierService: NotifierService,
): Promise<HandleResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.toString());
  } catch {
    logger.warn('consumer: dropping non-JSON message');
    return 'drop';
  }

  const result = envelopeSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ issues: result.error.issues }, 'consumer: dropping invalid message');
    return 'drop';
  }

  const message = result.data;

  try {
    if (message.type === EMAIL_CONFIRMATION_ROUTING_KEY) {
      await notifierService.sendConfirmationEmail(message.data);
    } else {
      await notifierService.sendReleaseNotification(message.data);
    }
    return 'ack';
  } catch (err) {
    logger.error({ err, type: message.type }, 'consumer: failed to send email, requeue');
    return 'requeue';
  }
}

export async function startEmailConsumer(
  channel: Channel,
  notifierService: NotifierService,
): Promise<void> {
  await channel.assertExchange(NOTIFICATIONS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(NOTIFICATIONS_QUEUE, { durable: true });
  await channel.bindQueue(NOTIFICATIONS_QUEUE, NOTIFICATIONS_EXCHANGE, EMAIL_ROUTING_PATTERN);
  await channel.prefetch(10);

  await channel.consume(NOTIFICATIONS_QUEUE, async (msg: ConsumeMessage | null) => {
    if (!msg) {
      return;
    }

    const result = await handleEmailMessage(msg.content, notifierService);

    if (result === 'ack') {
      channel.ack(msg);
    } else if (result === 'requeue') {
      channel.nack(msg, false, true);
    } else {
      channel.nack(msg, false, false);
    }
  });

  logger.info({ queue: NOTIFICATIONS_QUEUE }, 'email consumer started');
}
