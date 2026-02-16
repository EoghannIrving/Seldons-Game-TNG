/**
 * A simple deterministic random number generator.
 * Uses a linear congruential generator (LCG) algorithm.
 * Not cryptographically secure, but sufficient for deterministic game mechanics.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Returns the next pseudo-random floating point number between 0.0 and 1.0 (exclusive).
   */
  next(): number {
    // LCG parameters used by `glibc`
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x80000000;
  }

  /**
   * Returns a pseudo-random integer between min (inclusive) and max (exclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}
