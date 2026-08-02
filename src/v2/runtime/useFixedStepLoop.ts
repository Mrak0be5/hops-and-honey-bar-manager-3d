import { useEffect, useRef } from 'react';
import { FixedStepClock, type FixedStepClockOptions } from './FixedStepClock';

export interface FixedStepLoopOptions extends FixedStepClockOptions {
  paused: boolean;
  speed: number;
  onStep(stepSeconds: number): void;
  onFrame?(alpha: number): void;
}

/** Drives an authoritative simulation without coupling its clock to R3F. */
export function useFixedStepLoop(options: FixedStepLoopOptions) {
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const clockRef = useRef<FixedStepClock | null>(null);
  const clockSignature = `${options.hz ?? 25}:${options.maxFrameSeconds ?? 0.25}:${options.maxCatchUpSteps ?? 6}`;
  const signatureRef = useRef(clockSignature);

  if (!clockRef.current || signatureRef.current !== clockSignature) {
    clockRef.current = new FixedStepClock(options);
    signatureRef.current = clockSignature;
  }

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();

    const frame = (time: number) => {
      const current = callbacksRef.current;
      const clock = clockRef.current!;
      const deltaSeconds = Math.max(0, (time - previousTime) / 1_000);
      previousTime = time;

      if (current.paused || current.speed === 0) {
        clock.reset();
        current.onFrame?.(0);
      } else {
        const result = clock.advance(deltaSeconds, current.speed, current.onStep);
        current.onFrame?.(result.alpha);
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);
}
