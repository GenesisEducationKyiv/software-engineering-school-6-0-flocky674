import { describe, it, expect, vi } from 'vitest';
import { SagaOrchestrator, SagaStep } from '../../src/shared/saga/saga';

const silentLogger = { info: vi.fn(), error: vi.fn() };

interface Ctx {
  trail: string[];
}

describe('SagaOrchestrator', () => {
  it('runs all steps in order when every step succeeds', async () => {
    const step = (name: string): SagaStep<Ctx> => ({
      name,
      invoke: async (ctx) => {
        ctx.trail.push(`invoke:${name}`);
      },
      compensate: async (ctx) => {
        ctx.trail.push(`compensate:${name}`);
      },
    });

    const ctx: Ctx = { trail: [] };
    await new SagaOrchestrator<Ctx>([step('a'), step('b')], silentLogger).execute(ctx);

    expect(ctx.trail).toEqual(['invoke:a', 'invoke:b']);
  });

  it('compensates completed steps in reverse order when a step fails', async () => {
    const ctx: Ctx = { trail: [] };

    const stepA: SagaStep<Ctx> = {
      name: 'a',
      invoke: async (c) => {
        c.trail.push('invoke:a');
      },
      compensate: async (c) => {
        c.trail.push('compensate:a');
      },
    };
    const stepB: SagaStep<Ctx> = {
      name: 'b',
      invoke: async (c) => {
        c.trail.push('invoke:b');
      },
      compensate: async (c) => {
        c.trail.push('compensate:b');
      },
    };
    const stepC: SagaStep<Ctx> = {
      name: 'c',
      invoke: async () => {
        throw new Error('c failed');
      },
      compensate: async (c) => {
        c.trail.push('compensate:c');
      },
    };

    await expect(
      new SagaOrchestrator<Ctx>([stepA, stepB, stepC], silentLogger).execute(ctx),
    ).rejects.toThrow('c failed');

    // c never completed, so only a and b are compensated, in reverse order
    expect(ctx.trail).toEqual(['invoke:a', 'invoke:b', 'compensate:b', 'compensate:a']);
  });

  it('continues compensating even if one compensation throws', async () => {
    const compensateA = vi.fn().mockResolvedValue(undefined);
    const compensateB = vi.fn().mockRejectedValue(new Error('compensation b failed'));

    const stepA: SagaStep<Ctx> = { name: 'a', invoke: vi.fn(), compensate: compensateA };
    const stepB: SagaStep<Ctx> = { name: 'b', invoke: vi.fn(), compensate: compensateB };
    const stepC: SagaStep<Ctx> = {
      name: 'c',
      invoke: vi.fn().mockRejectedValue(new Error('boom')),
      compensate: vi.fn(),
    };

    await expect(
      new SagaOrchestrator<Ctx>([stepA, stepB, stepC], silentLogger).execute({ trail: [] }),
    ).rejects.toThrow('boom');

    expect(compensateB).toHaveBeenCalledOnce();
    expect(compensateA).toHaveBeenCalledOnce();
  });
});
