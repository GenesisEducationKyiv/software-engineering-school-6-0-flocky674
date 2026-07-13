import { ChannelCredentials } from '@grpc/grpc-js';
import { config } from '../../config/env';
import { MailVerificationServiceClient } from '../../generated/notifier/v1/mail';
import { ConfirmationPayload, NotificationPayload, NotifierPort } from './notifier.types';

/**
 * gRPC transport for the app -> notifier call. Drop-in replacement for the
 * REST `NotifierClient` (same `NotifierPort`), communicating over HTTP/2 +
 * Protobuf. The old REST client is kept alongside this one.
 */
export class NotifierGrpcClient implements NotifierPort {
  private readonly client: MailVerificationServiceClient;

  constructor(address: string = config.notifierService.grpcUrl) {
    this.client = new MailVerificationServiceClient(address, ChannelCredentials.createInsecure());
  }

  sendConfirmationEmail(payload: ConfirmationPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.sendConfirmationEmail(
        {
          email: payload.email,
          repoFullName: payload.repoFullName,
          confirmToken: payload.confirmToken,
          appUrl: config.appUrl,
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  sendReleaseNotification(payload: NotificationPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.sendReleaseNotification(
        {
          email: payload.email,
          repoFullName: payload.repoFullName,
          tagName: payload.tagName,
          releaseName: payload.releaseName,
          releaseUrl: payload.releaseUrl,
          unsubscribeToken: payload.unsubscribeToken,
          appUrl: config.appUrl,
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
}

export const notifierGrpcClient = new NotifierGrpcClient();
