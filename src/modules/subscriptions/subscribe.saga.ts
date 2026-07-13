import { Subscription } from '@prisma/client';
import { NotifierPort } from '../notifier/notifier.types';
import { SagaOrchestrator, SagaStep } from '../../shared/saga/saga';

/**
 * Minimal persistence surface the saga needs. Depending on this narrow
 * interface (not the full repository) keeps the saga decoupled and testable.
 */
export interface SubscriptionSagaRepository {
  create(data: { email: string; repositoryId: string }): Promise<Subscription>;
  deleteById(id: string): Promise<void>;
}

export interface SubscribeSagaInput {
  email: string;
  repositoryId: string;
  repoFullName: string;
}

interface SubscribeSagaContext extends SubscribeSagaInput {
  subscriptionId?: string;
  confirmToken?: string;
}

/**
 * Orchestrated Saga for the subscribe scenario. It coordinates a distributed
 * transaction across two services:
 *   1. app: persist a pending subscription (local DB)
 *   2. notifier: send the confirmation email (separate microservice via broker)
 *
 * If the notification step fails, the created subscription is compensated
 * (deleted), so the system never keeps a pending subscription that can never
 * be confirmed.
 */
export class SubscriptionConfirmationSaga {
  constructor(
    private readonly subscriptionRepo: SubscriptionSagaRepository,
    private readonly notifier: NotifierPort,
  ) {}

  async run(input: SubscribeSagaInput): Promise<void> {
    const steps: SagaStep<SubscribeSagaContext>[] = [
      {
        name: 'create-subscription',
        invoke: async (ctx) => {
          const subscription = await this.subscriptionRepo.create({
            email: ctx.email,
            repositoryId: ctx.repositoryId,
          });
          ctx.subscriptionId = subscription.id;
          ctx.confirmToken = subscription.confirmToken;
        },
        compensate: async (ctx) => {
          if (ctx.subscriptionId) {
            await this.subscriptionRepo.deleteById(ctx.subscriptionId);
          }
        },
      },
      {
        name: 'send-confirmation-email',
        invoke: async (ctx) => {
          await this.notifier.sendConfirmationEmail({
            email: ctx.email,
            repoFullName: ctx.repoFullName,
            confirmToken: ctx.confirmToken as string,
          });
        },
        compensate: async () => {
          // Nothing to undo: the email is either delivered or was never sent.
        },
      },
    ];

    const orchestrator = new SagaOrchestrator<SubscribeSagaContext>(steps);
    await orchestrator.execute({ ...input });
  }
}
