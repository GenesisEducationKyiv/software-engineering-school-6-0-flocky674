import logger from '../utils/logger';

/**
 * A single step of an orchestrated Saga. `invoke` performs the forward action;
 * `compensate` semantically undoes it if a later step fails.
 */
export interface SagaStep<TContext> {
  name: string;
  invoke(context: TContext): Promise<void>;
  compensate(context: TContext): Promise<void>;
}

export interface SagaLogger {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

/**
 * Orchestrated Saga: runs steps in order and, if any step fails, runs the
 * compensations of the already-completed steps in reverse order. Compensation
 * failures are logged but never mask the original error, and never stop the
 * remaining compensations.
 */
export class SagaOrchestrator<TContext> {
  constructor(
    private readonly steps: SagaStep<TContext>[],
    private readonly log: SagaLogger = logger,
  ) {}

  async execute(context: TContext): Promise<void> {
    const completed: SagaStep<TContext>[] = [];

    for (const step of this.steps) {
      try {
        await step.invoke(context);
        completed.push(step);
      } catch (err) {
        this.log.error({ step: step.name, err }, 'saga: step failed, compensating');
        await this.compensate(completed, context);
        throw err;
      }
    }
  }

  private async compensate(completed: SagaStep<TContext>[], context: TContext): Promise<void> {
    for (const step of [...completed].reverse()) {
      try {
        await step.compensate(context);
        this.log.info({ step: step.name }, 'saga: step compensated');
      } catch (compensationErr) {
        this.log.error(
          { step: step.name, err: compensationErr },
          'saga: compensation failed',
        );
      }
    }
  }
}
