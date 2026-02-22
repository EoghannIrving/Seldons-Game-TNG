/**
 * The Galactic Zeitgeist (Spirit of the Age)
 * Phase 5: Cyclical History Engine
 *
 * Manages the global oscillation between Order and Chaos.
 */

import { GalaxyState, CrisisType } from './types';
import { SeededRandom } from '../utils/seed-random';

// Config
const ZEITGEIST_PERIOD = 500; // Phases for a full cycle (Order -> Chaos -> Order)
const NOISE_MAGNITUDE = 0.2;  // Random fluctuation amount

/**
 * Computes the zeitgeist bias contributed by active Seldon Crises.
 *
 * Crises are rare, galaxy-defining events — they should visibly bend
 * the Spirit of the Age rather than leaving it on its nominal sine wave.
 *
 * Bias values:
 *   Economic: -0.25 (trade collapse → galactic depression)
 *   External (Mule): -0.45 (defies all psychohistorical prediction — maximum chaos)
 *   Technological: +0.15 (era of discovery pushes toward order)
 *   Religious: -0.10 (ideological upheaval, mild chaos)
 *
 * Multiple simultaneous crises stack (though MAX_ACTIVE_CRISES = 1 currently).
 * The final zeitgeist is still clamped to [-1, +1] after application.
 */
function computeCrisisBias(state: GalaxyState): number {
  if (!state.activeCrises || state.activeCrises.length === 0) return 0;

  let bias = 0;
  for (const crisis of state.activeCrises) {
    if (crisis.resolved) continue;
    switch (crisis.type) {
      case CrisisType.Economic:
        bias -= 0.25; // Trade collapse drives galactic depression
        break;
      case CrisisType.External:
        bias -= 0.45; // The Mule defies psychohistory — maximum chaos signature
        break;
      case CrisisType.Technological:
        bias += 0.15; // Tech leap pushes toward a new order
        break;
      case CrisisType.Religious:
        bias -= 0.10; // Ideological upheaval breeds uncertainty
        break;
      case CrisisType.Succession:
        bias -= 0.20; // Civil war destabilizes the galactic order
        break;
    }
  }
  return bias;
}

/**
 * Updates the global zeitgeist value based on the current phase.
 *
 * Logic:
 * - Base is a sine wave: sin(phase / period * 2PI)
 * - Returns a value between -1.0 (Chaos) and +1.0 (Order)
 * - Adds slight noise for unpredictability
 * - Active Seldon Crises bend the zeitgeist toward chaos or order
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

  // 3. Crisis Bias: active Seldon Crises bend the Spirit of the Age
  const crisisBias = computeCrisisBias(state);

  // 4. Clamp and Set
  let newValue = baseWave + noise + crisisBias;
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
