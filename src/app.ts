import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { buildSubscriptionRoutes } from './modules/subscriptions/subscription.controller';
import { SubscriptionService } from './modules/subscriptions/subscription.service';
import { SubscriptionRepository, RepositoryRepository } from './modules/subscriptions/subscription.repository';
import { GitHubService } from './modules/github/github.service';
import { githubClient } from './modules/github/github.client';
import { NotifierService } from './modules/notifier/notifier.service';
import { resolveNotifier } from './modules/notifier/notifier.factory';
import { AppError } from './shared/errors/app-error';
import { config } from './config/env';
import logger from './shared/utils/logger';
import {
  getMetrics,
  metricsContentType,
  recordHttpRequest,
} from './shared/metrics/prometheus';

const requestStartedAt = new WeakMap<object, bigint>();

interface AppDependencies {
  subscriptionRepo?: SubscriptionRepository;
  repositoryRepo?: RepositoryRepository;
  githubService?: GitHubService;
  notifierService?: NotifierService;
}

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const fastify = Fastify({ logger: false });

  fastify.addHook('onRequest', async (request) => {
    requestStartedAt.set(request, process.hrtime.bigint());
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStartedAt.get(request);
    const durationSeconds = startedAt
      ? Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
      : 0;
    const route = request.routeOptions.url ?? request.url.split('?')[0];

    recordHttpRequest(request.method, route, reply.statusCode, durationSeconds);
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        route,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(durationSeconds * 1000),
      },
      'http request completed',
    );
  });

  if (config.apiKey) {
    fastify.addHook('onRequest', async (request, reply) => {
      const publicPaths = ['/health', '/metrics', '/api/confirm/', '/api/unsubscribe/', '/'];
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
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metricsContentType);
    return getMetrics();
  });

  const subscriptionRepo = dependencies.subscriptionRepo ?? new SubscriptionRepository();
  const repositoryRepo = dependencies.repositoryRepo ?? new RepositoryRepository();
  const githubService = dependencies.githubService ?? new GitHubService(githubClient);
  const notifierService = dependencies.notifierService ?? resolveNotifier();
  const subscriptionService = new SubscriptionService(
    subscriptionRepo,
    repositoryRepo,
    githubService,
    notifierService,
  );

  buildSubscriptionRoutes(fastify, subscriptionService);

  return fastify;
}
