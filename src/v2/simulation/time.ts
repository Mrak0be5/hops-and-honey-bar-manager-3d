export const FIXED_TICKS_PER_SECOND = 25;
export const FIXED_DELTA_SECONDS = 1 / FIXED_TICKS_PER_SECOND;

export const secondsToTicks = (seconds: number) => (
  Math.max(1, Math.round(Math.max(0, seconds) * FIXED_TICKS_PER_SECOND))
);

export const ticksToSeconds = (ticks: number) => (
  Math.max(0, ticks) * FIXED_DELTA_SECONDS
);
