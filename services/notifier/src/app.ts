import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { buildEmailRoutes } from './routes/email.routes';
import { NotifierService } from './notifier/notifier.service';
import logger from './shared/utils/logger';

export function buildApp(): FastifyInstance {
  const fastify = Fastify({ logger: false });
  const notifierService = new NotifierService();

  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.message });
    }

    logger.error({ err: error, url: request.url }, 'unhandled notifier error');
    return reply.code(500).send({ error: 'Internal server error' });
  });

  fastify.get('/health', async () => ({ status: 'ok', service: 'notifier' }));

  buildEmailRoutes(fastify, notifierService);

  return fastify;
}
