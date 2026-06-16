import { config } from '../../config/env';
import { getChannel } from '../../shared/messaging/connection';
import {
  ConfirmationEmailData,
  EMAIL_CONFIRMATION_ROUTING_KEY,
  EMAIL_RELEASE_ROUTING_KEY,
  EmailMessage,
  NOTIFICATIONS_EXCHANGE,
  ReleaseEmailData,
} from '../../shared/messaging/contract';
import { ConfirmationPayload, NotificationPayload, NotifierPort } from './notifier.types';

export class NotifierPublisher implements NotifierPort {
  async sendConfirmationEmail(payload: ConfirmationPayload): Promise<void> {
    const data: ConfirmationEmailData = { ...payload, appUrl: config.appUrl };
    await this.publish({ type: EMAIL_CONFIRMATION_ROUTING_KEY, data });
  }

  async sendReleaseNotification(payload: NotificationPayload): Promise<void> {
    const data: ReleaseEmailData = { ...payload, appUrl: config.appUrl };
    await this.publish({ type: EMAIL_RELEASE_ROUTING_KEY, data });
  }

  private async publish(message: EmailMessage): Promise<void> {
    const channel = await getChannel();
    await channel.assertExchange(NOTIFICATIONS_EXCHANGE, 'topic', { durable: true });

    channel.publish(
      NOTIFICATIONS_EXCHANGE,
      message.type,
      Buffer.from(JSON.stringify(message)),
      { persistent: true, contentType: 'application/json' },
    );
  }
}

export const notifierPublisher = new NotifierPublisher();
