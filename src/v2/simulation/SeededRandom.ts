/** Deterministic Mulberry32 source with serializable state. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = SeededRandom.normalizeSeed(seed);
  }

  reset(seed: number) {
    this.state = SeededRandom.normalizeSeed(seed);
  }

  getState() {
    return this.state >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(minInclusive: number, maxExclusive: number) {
    const min = Math.ceil(minInclusive);
    const max = Math.floor(maxExclusive);
    if (max <= min) throw new Error(`Invalid random integer range: [${minInclusive}, ${maxExclusive})`);
    return min + Math.floor(this.next() * (max - min));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error('Cannot pick from an empty collection.');
    return values[this.int(0, values.length)];
  }

  private static normalizeSeed(seed: number) {
    if (!Number.isFinite(seed)) throw new Error(`Seed must be finite, received ${seed}.`);
    return Math.trunc(seed) >>> 0;
  }
}
