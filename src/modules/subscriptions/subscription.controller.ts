import { FastifyInstance } from 'fastify';
import { SubscriptionService } from './subscription.service';

interface SubscribeBody {
  email: string;
  repo: string;
}

interface TokenParams {
  token: string;
}

interface EmailQuery {
  email: string;
}

export function buildSubscriptionRoutes(fastify: FastifyInstance, service: SubscriptionService) {
  // POST /api/subscribe
  fastify.post<{ Body: SubscribeBody }>('/api/subscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'repo'],
        properties: {
          email: { type: 'string' },
          repo: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    await service.subscribe(req.body);
    return reply.code(200).send({ message: 'Confirmation email sent. Please check your inbox.' });
  });

  // GET /api/confirm/:token
  fastify.get<{ Params: TokenParams }>('/api/confirm/:token', async (req, reply) => {
    await service.confirm(req.params.token);
    return reply.send({ message: 'Subscription confirmed successfully.' });
  });

  // GET /api/unsubscribe/:token
  fastify.get<{ Params: TokenParams }>('/api/unsubscribe/:token', async (req, reply) => {
    await service.unsubscribe(req.params.token);
    return reply.send({ message: 'Successfully unsubscribed.' });
  });

  // GET /api/subscriptions?email=
  fastify.get<{ Querystring: EmailQuery }>('/api/subscriptions', async (req, reply) => {
    const subs = await service.getSubscriptionsByEmail(req.query.email);
    return reply.send(subs);
  });
}
