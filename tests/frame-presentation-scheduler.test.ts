import { describe, expect, it } from 'vitest';
import { FramePresentationScheduler } from '../src/performance/framePresentationScheduler';

describe('FramePresentationScheduler', () => {
  it('keeps a 40 FPS presentation budget on a 60 Hz display', () => {
    const scheduler = new FramePresentationScheduler(40);
    let presented = 0;

    for (let frame = 0; frame < 600; frame += 1) {
      if (scheduler.shouldPresent(frame / 60)) presented += 1;
    }

    expect(presented).toBeGreaterThanOrEqual(399);
    expect(presented).toBeLessThanOrEqual(401);
  });

  it('does not burst through missed frames after a long stall', () => {
    const scheduler = new FramePresentationScheduler(40);

    expect(scheduler.shouldPresent(0)).toBe(true);
    expect(scheduler.shouldPresent(0.016)).toBe(false);
    expect(scheduler.shouldPresent(2)).toBe(true);
    expect(scheduler.shouldPresent(2.016)).toBe(false);
  });

  it('rejects an invalid target frame rate', () => {
    expect(() => new FramePresentationScheduler(0)).toThrow(RangeError);
  });
});
