import { config } from '../../config/env';
import { NotifierPort } from './notifier.types';
import { notifierPublisher } from './notifier.publisher';
import { notifierClient } from './notifier.client';
import { notifierGrpcClient } from './notifier.grpc.client';
import logger from '../../shared/utils/logger';

/**
 * Selects the transport for the app -> notifier call based on configuration.
 * All three transports implement the same `NotifierPort`, so the rest of the
 * application is unaware of which one is used:
 *   - broker: publish a command to RabbitMQ (default)
 *   - http:   legacy REST call (kept for comparison)
 *   - grpc:   gRPC over HTTP/2 + Protobuf
 */
export function resolveNotifier(): NotifierPort {
  switch (config.notifierService.transport) {
    case 'http':
      return notifierClient;
    case 'grpc':
      return notifierGrpcClient;
    case 'broker':
      return notifierPublisher;
    default:
      logger.warn(
        { transport: config.notifierService.transport },
        'unknown notifier transport, falling back to broker',
      );
      return notifierPublisher;
  }
}
