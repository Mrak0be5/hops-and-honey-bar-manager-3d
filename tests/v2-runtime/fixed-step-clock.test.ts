import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../../src/v2/runtime/FixedStepClock';

describe('FixedStepClock', () => {
  it('executes deterministic 25 Hz steps independent of frame cadence', () => {
    const clock = new FixedStepClock({ hz: 25, maxCatchUpSteps: 10 });
    const steps: number[] = [];

    clock.advance(0.016, 1, (delta) => steps.push(delta));
    clock.advance(0.024, 1, (delta) => steps.push(delta));
    clock.advance(0.08, 1, (delta) => steps.push(delta));

    expect(steps).toHaveLength(3);
    expect(steps).toEqual([0.04, 0.04, 0.04]);
  });

  it('caps catch-up work and reports discarded time', () => {
    const clock = new FixedStepClock({ hz: 25, maxFrameSeconds: 0.25, maxCatchUpSteps: 3 });
    let calls = 0;

    const result = clock.advance(2, 1, () => {
      calls += 1;
    });

    expect(calls).toBe(3);
    expect(result.steps).toBe(3);
    expect(result.droppedSeconds).toBeGreaterThan(1.8);
    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThan(1);
  });

  it('applies simulation speed without changing the authoritative step size', () => {
    const clock = new FixedStepClock({ hz: 25 });
    const steps: number[] = [];

    clock.advance(0.04, 2, (delta) => steps.push(delta));

    expect(steps).toEqual([0.04, 0.04]);
  });

  it('rejects invalid clock input', () => {
    expect(() => new FixedStepClock({ hz: 0 })).toThrow(RangeError);
    const clock = new FixedStepClock();
    expect(() => clock.advance(-1, 1, () => undefined)).toThrow(RangeError);
    expect(() => clock.advance(1, -1, () => undefined)).toThrow(RangeError);
  });
});
