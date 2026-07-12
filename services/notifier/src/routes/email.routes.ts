import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NotifierService } from '../notifier/notifier.service';

const confirmationSchema = z.object({
  email: z.string().email(),
  repoFullName: z.string().min(1),
  confirmToken: z.string().min(1),
  appUrl: z.string().url(),
});

const releaseSchema = z.object({
  email: z.string().email(),
  repoFullName: z.string().min(1),
  tagName: z.string().min(1),
  releaseName: z.string(),
  releaseUrl: z.string().url(),
  unsubscribeToken: z.string().min(1),
  appUrl: z.string().url(),
});

export function buildEmailRoutes(fastify: FastifyInstance, notifierService: NotifierService) {
  fastify.post('/api/emails/confirmation', async (request, reply) => {
    const payload = confirmationSchema.parse(request.body);
    await notifierService.sendConfirmationEmail(payload);
    return reply.code(202).send({ status: 'accepted' });
  });

  fastify.post('/api/emails/release', async (request, reply) => {
    const payload = releaseSchema.parse(request.body);
    await notifierService.sendReleaseNotification(payload);
    return reply.code(202).send({ status: 'accepted' });
  });
}
