import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFrameRateSnapshot,
  recordPresentedFrame,
  resetFrameRateMeasurement,
  subscribeToFrameRate,
} from '../src/performance/frameRateStore';

describe('presented frame-rate measurement', () => {
  beforeEach(() => resetFrameRateMeasurement());

  it('reports the rate of frames actually presented during the sample window', () => {
    for (let timestamp = 0; timestamp <= 1_000; timestamp += 25) {
      recordPresentedFrame(timestamp);
    }

    expect(getFrameRateSnapshot()).toBe(40);
  });

  it('publishes only when the displayed integer value changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFrameRate(listener);

    for (let timestamp = 0; timestamp <= 2_000; timestamp += 25) {
      recordPresentedFrame(timestamp);
    }

    expect(getFrameRateSnapshot()).toBe(40);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('starts a fresh sample after a background-sized frame gap', () => {
    recordPresentedFrame(0);
    recordPresentedFrame(2_500);

    expect(getFrameRateSnapshot()).toBeNull();

    for (let timestamp = 2_525; timestamp <= 3_500; timestamp += 25) {
      recordPresentedFrame(timestamp);
    }

    expect(getFrameRateSnapshot()).toBe(40);
  });

  it('starts a fresh sample if a remounted renderer restarts its clock', () => {
    for (let timestamp = 0; timestamp <= 1_000; timestamp += 25) {
      recordPresentedFrame(timestamp);
    }
    expect(getFrameRateSnapshot()).toBe(40);

    recordPresentedFrame(0);
    expect(getFrameRateSnapshot()).toBeNull();

    for (let timestamp = 25; timestamp <= 1_000; timestamp += 25) {
      recordPresentedFrame(timestamp);
    }
    expect(getFrameRateSnapshot()).toBe(40);
  });
});
