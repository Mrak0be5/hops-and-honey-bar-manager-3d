const SAMPLE_WINDOW_MS = 1_000;
const BACKGROUND_GAP_MS = 2_000;

type FrameRateListener = () => void;

let currentFrameRate: number | null = null;
let sampleStartedAt: number | null = null;
let lastFrameAt: number | null = null;
let framesInSample = 0;
const listeners = new Set<FrameRateListener>();

function publish(frameRate: number | null) {
  if (frameRate === currentFrameRate) return;
  currentFrameRate = frameRate;
  listeners.forEach((listener) => listener());
}

export function recordPresentedFrame(timestampMs: number) {
  if (!Number.isFinite(timestampMs)) return;

  if (
    lastFrameAt !== null
    && (timestampMs <= lastFrameAt || timestampMs - lastFrameAt > BACKGROUND_GAP_MS)
  ) {
    publish(null);
    sampleStartedAt = timestampMs;
    framesInSample = 0;
    lastFrameAt = timestampMs;
    return;
  }

  lastFrameAt = timestampMs;
  if (sampleStartedAt === null) {
    sampleStartedAt = timestampMs;
    return;
  }

  framesInSample += 1;
  const elapsed = timestampMs - sampleStartedAt;
  if (elapsed < SAMPLE_WINDOW_MS) return;

  publish(Math.max(0, Math.round(framesInSample * 1_000 / elapsed)));
  sampleStartedAt = timestampMs;
  framesInSample = 0;
}

export function subscribeToFrameRate(listener: FrameRateListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFrameRateSnapshot() {
  return currentFrameRate;
}

export function resetFrameRateMeasurement() {
  publish(null);
  sampleStartedAt = null;
  lastFrameAt = null;
  framesInSample = 0;
}
