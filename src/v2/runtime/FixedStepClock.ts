export interface FixedStepAdvanceResult {
  /** Number of authoritative simulation steps executed for this frame. */
  steps: number;
  /** Interpolation position between the previous and current simulation state. */
  alpha: number;
  /** Real time discarded to avoid a spiral of death after a long suspension. */
  droppedSeconds: number;
}

export interface FixedStepClockOptions {
  hz?: number;
  maxFrameSeconds?: number;
  maxCatchUpSteps?: number;
}

/**
 * Browser-independent fixed-step accumulator. The simulation receives the same
 * delta on every tick; rendering may use alpha to interpolate visual state.
 */
export class FixedStepClock {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxCatchUpSteps: number;

  private accumulatorSeconds = 0;

  constructor(options: FixedStepClockOptions = {}) {
    const hz = options.hz ?? 25;
    if (!Number.isFinite(hz) || hz <= 0) {
      throw new RangeError('FixedStepClock hz must be a positive finite number.');
    }

    this.stepSeconds = 1 / hz;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.25;
    this.maxCatchUpSteps = options.maxCatchUpSteps ?? 6;

    if (!Number.isFinite(this.maxFrameSeconds) || this.maxFrameSeconds <= 0) {
      throw new RangeError('FixedStepClock maxFrameSeconds must be positive.');
    }
    if (!Number.isInteger(this.maxCatchUpSteps) || this.maxCatchUpSteps <= 0) {
      throw new RangeError('FixedStepClock maxCatchUpSteps must be a positive integer.');
    }
  }

  reset() {
    this.accumulatorSeconds = 0;
  }

  advance(realDeltaSeconds: number, speed: number, onStep: (stepSeconds: number) => void): FixedStepAdvanceResult {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('FixedStepClock delta must be a non-negative finite number.');
    }
    if (!Number.isFinite(speed) || speed < 0) {
      throw new RangeError('FixedStepClock speed must be a non-negative finite number.');
    }

    const scaledDelta = realDeltaSeconds * speed;
    const acceptedDelta = Math.min(scaledDelta, this.maxFrameSeconds);
    let droppedSeconds = Math.max(0, scaledDelta - acceptedDelta);
    this.accumulatorSeconds += acceptedDelta;

    let steps = 0;
    while (this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds && steps < this.maxCatchUpSteps) {
      onStep(this.stepSeconds);
      this.accumulatorSeconds -= this.stepSeconds;
      steps += 1;
    }

    if (this.accumulatorSeconds >= this.stepSeconds) {
      const retained = this.accumulatorSeconds % this.stepSeconds;
      droppedSeconds += this.accumulatorSeconds - retained;
      this.accumulatorSeconds = retained;
    }

    return {
      steps,
      alpha: Math.min(1, Math.max(0, this.accumulatorSeconds / this.stepSeconds)),
      droppedSeconds,
    };
  }
}
