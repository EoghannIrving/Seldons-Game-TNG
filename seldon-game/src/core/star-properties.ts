/**
 * Star properties - Type and trait definitions with gameplay effects
 * Phase 2: Planet Personalities
 */

import { StarType, Trait, TraitCategory } from './types';

/**
 * Star type characteristics
 */
export interface StarTypeProperties {
  name: string;
  description: string;
  color: string;
  size: number;              // Relative size (0.5 - 2.0)
  growthModifier: number;    // Multiplier for growth rate
  stabilityModifier: number; // Affects centralization tendency
  glowIntensity: number;     // Visual glow effect (0-1)
  peakAge: number;           // Phase when growth peaks
  decayRate: number;         // How fast growth declines after peak (0-1)
  spectralClass?: string;    // Astronomical spectral classification
}

export const STAR_TYPE_PROPERTIES: Record<StarType, StarTypeProperties> = {
  [StarType.BlueGiant]: {
    name: 'Blue Giant',
    description: 'Massive, short-lived, intense. High growth but unstable.',
    color: '#4477FF',
    size: 1.8,
    growthModifier: 1.3,
    stabilityModifier: 0.7,
    glowIntensity: 0.9,
    peakAge: 50,      // Peak early
    decayRate: 0.004, // Fast decay (burns out quickly)
    spectralClass: 'O5V',
  },
  [StarType.YellowDwarf]: {
    name: 'Yellow Dwarf',
    description: 'Stable, moderate, reliable. Balanced in all aspects.',
    color: '#FFDD44',
    size: 1.0,
    growthModifier: 1.0,
    stabilityModifier: 1.0,
    glowIntensity: 0.6,
    peakAge: 150,      // Peaks late (mature civilization)
    decayRate: 0.0005, // Very slow decay (long-lived)
    spectralClass: 'G2V',
  },
  [StarType.RedDwarf]: {
    name: 'Red Dwarf',
    description: 'Small, dim, long-lived. Slow growth but extremely stable.',
    color: '#DD4444',
    size: 0.7,
    growthModifier: 0.7,
    stabilityModifier: 1.4,
    glowIntensity: 0.4,
    peakAge: 300,      // Peaks very late
    decayRate: 0.0001, // Almost no decay (eternal)
    spectralClass: 'M5V',
  },
  [StarType.RedGiant]: {
    name: 'Red Giant',
    description: 'Dying star, fading glory. High power but declining growth.',
    color: '#FF6633',
    size: 1.6,
    growthModifier: 0.8,
    stabilityModifier: 0.9,
    glowIntensity: 0.7,
    peakAge: 0,        // Already past peak (dying)
    decayRate: 0.003,  // Steady decline
    spectralClass: 'K3III',
  },
  [StarType.WhiteDwarf]: {
    name: 'White Dwarf',
    description: 'Stellar remnant. Low growth, high centralization.',
    color: '#EEFFFF',
    size: 0.5,
    growthModifier: 0.6,
    stabilityModifier: 1.2,
    glowIntensity: 0.8,
    peakAge: 0,        // Already burned out
    decayRate: 0.001,  // Slow fade
    spectralClass: 'DA2',
  },
  [StarType.Binary]: {
    name: 'Binary System',
    description: 'Two stars orbiting each other. Dual personality, volatile.',
    color: '#FF88DD',
    size: 1.3,
    growthModifier: 1.1,
    stabilityModifier: 0.8,
    glowIntensity: 0.7,
    peakAge: 100,      // Medium peak
    decayRate: 0.002,  // Medium decay
    spectralClass: 'F8V+K1V',
  },
};

/**
 * Trait characteristics and gameplay effects
 */
export interface TraitProperties {
  name: string;
  category: TraitCategory;
  description: string;
  icon: string;  // Icon identifier (can be emoji or CSS class)

  // Gameplay modifiers (all optional)
  growthModifier?: number;
  centralizationModifier?: number;
  powerModifier?: number;
  influenceRangeModifier?: number;
}

export const TRAIT_PROPERTIES: Record<Trait, TraitProperties> = {
  // Political Traits
  [Trait.Imperialist]: {
    name: 'Imperialist',
    category: TraitCategory.Political,
    description: 'Naturally high centralization, seeks to rule others',
    icon: '👑',
    centralizationModifier: 1.15,
    influenceRangeModifier: 1.1,
  },
  [Trait.Republican]: {
    name: 'Republican',
    category: TraitCategory.Political,
    description: 'Resists centralization, prefers independence',
    icon: '⚖️',
    centralizationModifier: 0.85,
  },
  [Trait.Adaptable]: {
    name: 'Adaptable',
    category: TraitCategory.Political,
    description: 'Adapts government type and ideology readily based on circumstances',
    icon: '🔄',
    growthModifier: 1.05,
  },
  [Trait.Traditionalist]: {
    name: 'Traditionalist',
    category: TraitCategory.Political,
    description: 'Resists government transitions and ideological drift, maintains cultural identity',
    icon: '📜',
    centralizationModifier: 1.1,
  },

  // Economic Traits
  [Trait.Mercantile]: {
    name: 'Mercantile',
    category: TraitCategory.Economic,
    description: 'Trading civilization. Growth bonus when connected to many trade routes',
    icon: '💰',
    growthModifier: 1.15,
  },
  [Trait.Agrarian]: {
    name: 'Agrarian',
    category: TraitCategory.Economic,
    description: 'Steady slow growth, resistant to shocks',
    icon: '🌾',
    growthModifier: 0.9,
    centralizationModifier: 1.05,
  },
  [Trait.Industrial]: {
    name: 'Industrial',
    category: TraitCategory.Economic,
    description: 'High growth but vulnerable to collapse',
    icon: '🏭',
    growthModifier: 1.2,
    centralizationModifier: 0.95,
  },
  [Trait.PostScarcity]: {
    name: 'Post-Scarcity',
    category: TraitCategory.Economic,
    description: 'Low growth but extremely stable',
    icon: '✨',
    growthModifier: 0.85,
    centralizationModifier: 1.15,
  },

  // Social Traits
  [Trait.Cosmopolitan]: {
    name: 'Cosmopolitan',
    category: TraitCategory.Social,
    description: 'Easily integrates into empires, low rebellion',
    icon: '🌍',
    powerModifier: 1.05,
  },
  [Trait.Xenophobic]: {
    name: 'Xenophobic',
    category: TraitCategory.Social,
    description: 'Resists foreign rule, high rebellion chance',
    icon: '🛡️',
    powerModifier: 0.95,
  },
  [Trait.Scholarly]: {
    name: 'Scholarly',
    category: TraitCategory.Social,
    description: 'Academic civilization. Better predictions and stability',
    icon: '📚',
    growthModifier: 1.05,
  },
  [Trait.Militaristic]: {
    name: 'Militaristic',
    category: TraitCategory.Social,
    description: 'Power projection bonus, influence extends farther',
    icon: '⚔️',
    powerModifier: 1.15,
    influenceRangeModifier: 1.15,
  },
  [Trait.Spiritualist]: {
    name: 'Spiritualist',
    category: TraitCategory.Social,
    description: 'Values tradition and faith. Resists Materialist rule.',
    icon: '🛐',
    centralizationModifier: 1.05,
  },
  [Trait.Materialist]: {
    name: 'Materialist',
    category: TraitCategory.Social,
    description: 'Values science and progress. Resists Spiritualist rule.',
    icon: '⚛️',
    growthModifier: 1.05,
  },

  // Psychological Traits
  [Trait.Ambitious]: {
    name: 'Ambitious',
    category: TraitCategory.Psychological,
    description: 'Always trying to expand influence',
    icon: '🎯',
    powerModifier: 1.1,
    growthModifier: 1.05,
  },
  [Trait.Cautious]: {
    name: 'Cautious',
    category: TraitCategory.Psychological,
    description: 'Maintains buffer zones, defensive',
    icon: '🧭',
    centralizationModifier: 1.1,
  },
  [Trait.Volatile]: {
    name: 'Volatile',
    category: TraitCategory.Psychological,
    description: 'Rapid swings in centralization and growth',
    icon: '⚡',
    growthModifier: 1.1,
    centralizationModifier: 0.9,
  },
  [Trait.Stoic]: {
    name: 'Stoic',
    category: TraitCategory.Psychological,
    description: 'Minimal changes, resists trends',
    icon: '🗿',
    centralizationModifier: 1.05,
  },
};

/**
 * Calculate age-based growth decay for a star
 * Blue Giants peak early and burn out, Red Dwarfs grow forever
 */
export function getAgeModifier(starType: StarType, currentPhase: number): number {
  const typeProps = STAR_TYPE_PROPERTIES[starType];
  const { peakAge, decayRate } = typeProps;

  // Before peak: normal growth
  if (currentPhase <= peakAge) {
    return 1.0;
  }

  // After peak: exponential decay
  const ageAfterPeak = currentPhase - peakAge;
  const decayFactor = Math.exp(-decayRate * ageAfterPeak);

  // Minimum 0.3x growth (stars don't completely stop growing)
  return Math.max(0.3, decayFactor);
}

/**
 * Get combined modifiers from star type and traits
 */
export function getCombinedModifiers(
  starType: StarType,
  traits: Trait[],
  currentPhase?: number
): {
  growthModifier: number;
  centralizationModifier: number;
  powerModifier: number;
  influenceRangeModifier: number;
} {
  const typeProps = STAR_TYPE_PROPERTIES[starType];

  let growthModifier = typeProps.growthModifier;
  let centralizationModifier = typeProps.stabilityModifier;
  let powerModifier = 1.0;
  let influenceRangeModifier = 1.0;

  // Apply age-based decay if phase is provided
  if (currentPhase !== undefined) {
    const ageModifier = getAgeModifier(starType, currentPhase);
    growthModifier *= ageModifier;
  }

  for (const trait of traits) {
    const traitProps = TRAIT_PROPERTIES[trait];
    if (traitProps.growthModifier) {
      growthModifier *= traitProps.growthModifier;
    }
    if (traitProps.centralizationModifier) {
      centralizationModifier *= traitProps.centralizationModifier;
    }
    if (traitProps.powerModifier) {
      powerModifier *= traitProps.powerModifier;
    }
    if (traitProps.influenceRangeModifier) {
      influenceRangeModifier *= traitProps.influenceRangeModifier;
    }
  }

  return {
    growthModifier,
    centralizationModifier,
    powerModifier,
    influenceRangeModifier,
  };
}
