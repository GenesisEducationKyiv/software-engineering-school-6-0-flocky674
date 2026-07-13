import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { MailVerificationServiceService } from '../../src/generated/notifier/v1/mail';
import { NotifierGrpcClient } from '../../src/modules/notifier/notifier.grpc.client';

const confirmationHandler = vi.fn();

function buildTestServer(): Promise<{ server: grpc.Server; port: number }> {
  const server = new grpc.Server();
  server.addService(MailVerificationServiceService, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendConfirmationEmail: (call: any, callback: any) => {
      confirmationHandler(call.request);
      if (call.request.email === 'fail@example.com') {
        callback({ code: grpc.status.INVALID_ARGUMENT, message: 'bad email' });
        return;
      }
      callback(null, { accepted: true });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendReleaseNotification: (_call: any, callback: any) => callback(null, { accepted: true }),
  });

  return new Promise((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject(err);
      resolve({ server, port });
    });
  });
}

describe('NotifierGrpcClient (round-trip over gRPC)', () => {
  let server: grpc.Server;
  let client: NotifierGrpcClient;

  beforeAll(async () => {
    const started = await buildTestServer();
    server = started.server;
    client = new NotifierGrpcClient(`127.0.0.1:${started.port}`);
  });

  afterAll(() => {
    server.forceShutdown();
  });

  it('sends a confirmation email over gRPC and resolves', async () => {
    await expect(
      client.sendConfirmationEmail({
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token',
      }),
    ).resolves.toBeUndefined();

    expect(confirmationHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token',
        appUrl: expect.any(String),
      }),
    );
  });

  it('rejects when the server returns a gRPC error status', async () => {
    await expect(
      client.sendConfirmationEmail({
        email: 'fail@example.com',
        repoFullName: 'golang/go',
        confirmToken: 'confirm-token',
      }),
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });
});
