import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Architecture dependency test (HW#11 star): runs dependency-cruiser against the
 * layer rules in .dependency-cruiser.cjs and fails if any rule is violated
 * (wrong dependency direction between layers or a circular dependency).
 */
describe('architecture dependencies', () => {
  it('respects the layer dependency rules', () => {
    const root = path.resolve(__dirname, '..', '..');
    const bin = path.join(root, 'node_modules', '.bin', 'depcruise');

    let output = '';
    let failed = false;
    try {
      output = execFileSync(bin, ['src', '--config', '.dependency-cruiser.cjs'], {
        cwd: root,
        encoding: 'utf8',
      });
    } catch (err) {
      failed = true;
      const e = err as { stdout?: string; stderr?: string };
      output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    }

    expect(failed, output).toBe(false);
    expect(output).toContain('no dependency violations found');
  });
});
