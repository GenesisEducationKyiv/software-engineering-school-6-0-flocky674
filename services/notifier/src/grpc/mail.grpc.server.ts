import * as grpc from '@grpc/grpc-js';
import {
  MailVerificationServiceServer,
  MailVerificationServiceService,
  SendConfirmationEmailRequest,
  SendReleaseNotificationRequest,
} from '../generated/notifier/v1/mail';
import { NotifierService } from '../notifier/notifier.service';
import logger from '../shared/utils/logger';

function requireFields(
  request: Record<string, string>,
  fields: string[],
): string | null {
  for (const field of fields) {
    if (!request[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * gRPC implementation of MailVerificationService. Mirrors the existing REST
 * routes but communicates over HTTP/2 + Protobuf. Errors are mapped to proper
 * gRPC status codes (INVALID_ARGUMENT for bad input, INTERNAL for delivery
 * failures) instead of HTTP status codes.
 */
export function createMailServiceHandlers(
  notifierService: NotifierService,
): MailVerificationServiceServer {
  return {
    sendConfirmationEmail: async (call, callback) => {
      const request = call.request as SendConfirmationEmailRequest;
      const validationError = requireFields(request as unknown as Record<string, string>, [
        'email',
        'repoFullName',
        'confirmToken',
        'appUrl',
      ]);
      if (validationError) {
        callback({ code: grpc.status.INVALID_ARGUMENT, message: validationError });
        return;
      }

      try {
        await notifierService.sendConfirmationEmail({
          email: request.email,
          repoFullName: request.repoFullName,
          confirmToken: request.confirmToken,
          appUrl: request.appUrl,
        });
        callback(null, { accepted: true });
      } catch (err) {
        logger.error({ err }, 'grpc: failed to send confirmation email');
        callback({ code: grpc.status.INTERNAL, message: 'Failed to send confirmation email' });
      }
    },

    sendReleaseNotification: async (call, callback) => {
      const request = call.request as SendReleaseNotificationRequest;
      const validationError = requireFields(request as unknown as Record<string, string>, [
        'email',
        'repoFullName',
        'tagName',
        'releaseUrl',
        'unsubscribeToken',
        'appUrl',
      ]);
      if (validationError) {
        callback({ code: grpc.status.INVALID_ARGUMENT, message: validationError });
        return;
      }

      try {
        await notifierService.sendReleaseNotification({
          email: request.email,
          repoFullName: request.repoFullName,
          tagName: request.tagName,
          releaseName: request.releaseName,
          releaseUrl: request.releaseUrl,
          unsubscribeToken: request.unsubscribeToken,
          appUrl: request.appUrl,
        });
        callback(null, { accepted: true });
      } catch (err) {
        logger.error({ err }, 'grpc: failed to send release notification');
        callback({ code: grpc.status.INTERNAL, message: 'Failed to send release notification' });
      }
    },
  };
}

export function createMailGrpcServer(notifierService: NotifierService): grpc.Server {
  const server = new grpc.Server();
  server.addService(MailVerificationServiceService, createMailServiceHandlers(notifierService));
  return server;
}

export function startMailGrpcServer(
  notifierService: NotifierService,
  host: string,
  port: number,
): Promise<grpc.Server> {
  const server = createMailGrpcServer(notifierService);

  return new Promise((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info({ port: boundPort }, 'notifier gRPC server started');
      resolve(server);
    });
  });
}
