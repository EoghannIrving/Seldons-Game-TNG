/**
 * Seeded random number generator
 * Ensures deterministic results from same seed
 * Uses Mulberry32 algorithm (fast and good quality)
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number between 0 and 1
   * Mulberry32 algorithm
   */
  random(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * Get current seed state (for saving/loading)
   */
  getState(): number {
    return this.state;
  }

  /**
   * Set seed state (for loading saves)
   */
  setState(state: number): void {
    this.state = state;
  }
}
