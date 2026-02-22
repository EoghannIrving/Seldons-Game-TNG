/**
 * Great People System (Genius Leaders)
 * Phase 5: Cyclical History Engine
 * 
 * Handles the spawning and death of rare, powerful leaders.
 */

import { Star, GalaxyState, EventType } from './types';
import { SeededRandom } from '../utils/seed-random';
import { getLeaderTitle } from './government';

// Config
const LEADER_SPAWN_CHANCE = 0.0005; // 0.05% per star per phase (Very Rare, ~1 per 20 phases @ 100 stars)
const LEADER_DURATION_MIN = 30;     // Minimum rule length (phases) - slightly longer reigns
const LEADER_DURATION_MAX = 80;     // Maximum rule length (phases)
const CHAOS_BONUS = 1.5;            // Multiplier for spawn chance in Chaos era (Reduced from 2.0)

const LEADER_NAMES = [
  'Alexander', 'Napoleon', 'Caesar', 'Genghis', 'Charlemagne', 
  'Suleiman', 'Elizabeth', 'Victoria', 'Cyrus', 'Ashoka',
  'Saladin', 'Augustus', 'Constantine', 'Justinian', 'Trajan',
  'Cleopatra', 'Pericles', 'Hammurabi', 'Nebuchadnezzar', 'Zenobia',
  'Meiji', 'Bolivar', 'Lincoln', 'Mandela', 'Ghandi',
  'Catherine', 'Peter', 'Frederick', 'Bismarck', 'Garibaldi',
  'Sun Tzu', 'Qin Shi Huang', 'Wu Zetian', 'Kublai', 'Akbar',
  'Hari Seldon', 'Gaal Dornick', 'Salvor Hardin', 'Hober Mallow', 'Bel Riose',
  'Cleon', 'Eto Demerzel', 'Bayta Darell', 'Arkady Darell', 'Han Pritcher',
  'Susan Calvin', 'Elijah Baley', 'R. Daneel Olivaw', 'R. Giskard Reventlov', 'Han Fastolfe',
  'Gladia Delmarre', 'Kelden Amadiro', 'Vasilia Aliena'
];

/**
 * Updates the leader status for a star.
 * 1. Checks if current leader dies.
 * 2. Attempts to spawn a new leader if slot is empty.
 * Returns a notification object if an event occurred, null otherwise.
 */
export function updateLeaders(star: Star, state: GalaxyState): { text: string; type: 'info' | 'success' | 'warning' | 'danger'; starId?: string } | null {
  const { phase, zeitgeist, config } = state;
  
  // Create a unique seed for this star at this phase
  // Parse numeric ID from "star_123" to ensure uniqueness
  const starIdNum = parseInt(star.id.split('_')[1] || '0');
  const uniqueSeed = config.seed + (phase * 997) + (starIdNum * 7919);
  const rng = new SeededRandom(uniqueSeed);

  // 1. Check for Death
  if (star.geniusLeader) {
    if (phase >= star.geniusLeader.expiresAt) {
      const deadLeaderName = star.geniusLeader.name;
      // Leader Dies
      star.history.push({
        type: EventType.LeaderDeath,
        phase,
        description: `The reign of ${deadLeaderName} has ended. The empire struggles to maintain its size.`
      });
      star.geniusLeader = undefined;
      
      return {
        text: `The legendary ${deadLeaderName} has died on ${star.name}.`,
        type: 'warning',
        starId: star.id
      };
    }
    return null; // Can't spawn a new one while one exists
  }

  // 2. Check for Birth
  // Base chance
  let chance = LEADER_SPAWN_CHANCE;
  
  // Modifiers
  // Chaos breeds heroes
  if (zeitgeist < -0.2) chance *= CHAOS_BONUS;
  
  // Use a different seed for the chance check to ensure it's not correlated with other rolls
  // Or just rely on the first random call being good enough.
  
  if (rng.random() < chance) {
    // A Great Person is Born!
    const duration = LEADER_DURATION_MIN + Math.floor(rng.random() * (LEADER_DURATION_MAX - LEADER_DURATION_MIN));
    const nameIndex = Math.floor(rng.random() * LEADER_NAMES.length);
    const name = LEADER_NAMES[nameIndex] || 'Unknown Hero';
    
    // Phase 10: Title derived from government type
    const titleSeed = uniqueSeed + nameIndex * 31;
    const title = star.governmentType ? getLeaderTitle(star.governmentType, titleSeed) : undefined;

    star.geniusLeader = {
      name,
      bonusMultiplier: 2.0, // Double capacity!
      expiresAt: phase + duration,
      title,
    };

    const titlePrefix = title ? `${title} ` : '';
    star.history.push({
      type: EventType.LeaderSpawn,
      phase,
      description: `${titlePrefix}${name} has risen to power! Administrative efficiency doubles.`
    });

    return {
      text: `${titlePrefix}${name} has risen on ${star.name}!`,
      type: 'success',
      starId: star.id
    };
  }
  
  return null;
}
