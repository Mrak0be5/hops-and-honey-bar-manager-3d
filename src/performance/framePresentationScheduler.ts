const DEFAULT_TARGET_FPS = 40;
const DEADLINE_EPSILON_SECONDS = 0.001;

export class FramePresentationScheduler {
  private readonly interval: number;
  private nextFrameAt: number | null = null;

  constructor(targetFps = DEFAULT_TARGET_FPS) {
    if (!Number.isFinite(targetFps) || targetFps <= 0) {
      throw new RangeError('targetFps must be a positive finite number');
    }
    this.interval = 1 / targetFps;
  }

  shouldPresent(timestampSeconds: number) {
    if (!Number.isFinite(timestampSeconds)) return false;

    if (
      this.nextFrameAt === null
      || timestampSeconds - this.nextFrameAt > this.interval * 2
    ) {
      this.nextFrameAt = timestampSeconds + this.interval;
      return true;
    }

    if (timestampSeconds + DEADLINE_EPSILON_SECONDS < this.nextFrameAt) {
      return false;
    }

    do {
      this.nextFrameAt += this.interval;
    } while (this.nextFrameAt <= timestampSeconds);
    return true;
  }
}
