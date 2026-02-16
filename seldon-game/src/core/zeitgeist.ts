/**
 * The Galactic Zeitgeist (Spirit of the Age)
 * Phase 5: Cyclical History Engine
 * 
 * Manages the global oscillation between Order and Chaos.
 */

import { GalaxyState } from './types';
import { SeededRandom } from '../utils/seed-random';

// Config
const ZEITGEIST_PERIOD = 500; // Phases for a full cycle (Order -> Chaos -> Order)
const NOISE_MAGNITUDE = 0.2;  // Random fluctuation amount

/**
 * Updates the global zeitgeist value based on the current phase.
 * 
 * Logic:
 * - Base is a sine wave: sin(phase / period * 2PI)
 * - Returns a value between -1.0 (Chaos) and +1.0 (Order)
 * - Adds slight noise for unpredictability
 */
export function updateZeitgeist(state: GalaxyState): void {
  const { phase, config } = state;
  const rng = new SeededRandom(config.seed + phase);

  // 1. Calculate Base Wave
  // Period is ZEITGEIST_PERIOD
  const frequency = (2 * Math.PI) / ZEITGEIST_PERIOD;
  const baseWave = Math.sin(phase * frequency);

  // 2. Add Noise
  // Noise shouldn't flip the sign violently, just add texture
  const noise = (rng.random() - 0.5) * NOISE_MAGNITUDE;

  // 3. Clamp and Set
  let newValue = baseWave + noise;
  if (newValue > 1.0) newValue = 1.0;
  if (newValue < -1.0) newValue = -1.0;

  state.zeitgeist = newValue;
}

/**
 * Get a descriptive name for the current era
 */
export function getEraName(zeitgeist: number): string {
  if (zeitgeist > 0.6) return 'Golden Age of Order';
  if (zeitgeist > 0.2) return 'Era of Consolidation';
  if (zeitgeist > -0.2) return 'Age of Uncertainty';
  if (zeitgeist > -0.6) return 'Era of Conflict';
  return 'Dark Age of Chaos';
}
