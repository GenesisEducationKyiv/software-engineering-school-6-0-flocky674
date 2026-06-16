import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { buildSubscriptionRoutes } from './modules/subscriptions/subscription.controller';
import { SubscriptionService } from './modules/subscriptions/subscription.service';
import { SubscriptionRepository, RepositoryRepository } from './modules/subscriptions/subscription.repository';
import { GitHubService } from './modules/github/github.service';
import { githubClient } from './modules/github/github.client';
import { notifierPublisher } from './modules/notifier/notifier.publisher';
import { AppError } from './shared/errors/app-error';
import { config } from './config/env';
import logger from './shared/utils/logger';

export function buildApp(): FastifyInstance {
  const fastify = Fastify({ logger: false });

  if (config.apiKey) {
    fastify.addHook('onRequest', async (request, reply) => {
      const publicPaths = ['/health', '/api/confirm/', '/api/unsubscribe/', '/'];
      const isPublic = publicPaths.some((p) => request.url.startsWith(p));
      if (isPublic) return;

      if (request.headers['x-api-key'] !== config.apiKey) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    });
  }

  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: error.message });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    logger.error({ err: error, url: request.url }, 'unhandled error');
    return reply.code(500).send({ error: 'Internal server error' });
  });

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
  });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  const subscriptionRepo = new SubscriptionRepository();
  const repositoryRepo = new RepositoryRepository();
  const githubService = new GitHubService(githubClient);
  const subscriptionService = new SubscriptionService(
    subscriptionRepo,
    repositoryRepo,
    githubService,
    notifierPublisher,
  );

  buildSubscriptionRoutes(fastify, subscriptionService);

  return fastify;
}
