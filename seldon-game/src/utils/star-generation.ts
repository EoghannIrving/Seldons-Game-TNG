/**
 * Star generation utilities
 * Phase 2: Planet Personalities
 */

import { StarType, Trait } from '../core/types';
import { SeededRandom } from './seed-random';

/**
 * Assign a star type based on seeded random
 * Distribution approximates realistic stellar population
 */
export function assignStarType(rng: SeededRandom): StarType {
  const roll = rng.random();

  // Realistic-ish distribution:
  // Red Dwarfs: 50% (most common)
  // Yellow Dwarfs: 20%
  // Red Giants: 15%
  // Blue Giants: 8%
  // White Dwarfs: 5%
  // Binary: 2%

  if (roll < 0.50) return StarType.RedDwarf;
  if (roll < 0.70) return StarType.YellowDwarf;
  if (roll < 0.85) return StarType.RedGiant;
  if (roll < 0.93) return StarType.BlueGiant;
  if (roll < 0.98) return StarType.WhiteDwarf;
  return StarType.Binary;
}

/**
 * Assign 2-3 traits to a star
 * Ensures variety across categories
 */
export function assignTraits(rng: SeededRandom, starType: StarType): Trait[] {
  const traits: Trait[] = [];

  // Political traits
  const politicalTraits = [
    Trait.Imperialist,
    Trait.Republican,
    Trait.Adaptable,
    Trait.Traditionalist,
  ];

  // Economic traits
  const economicTraits = [
    Trait.Mercantile,
    Trait.Agrarian,
    Trait.Industrial,
    Trait.PostScarcity,
  ];

  // Social traits
  const socialTraits = [
    Trait.Cosmopolitan,
    Trait.Xenophobic,
    Trait.Scholarly,
    Trait.Militaristic,
  ];

  // Psychological traits
  const psychologicalTraits = [
    Trait.Ambitious,
    Trait.Cautious,
    Trait.Volatile,
    Trait.Stoic,
  ];

  // Always assign one political trait
  traits.push(politicalTraits[Math.floor(rng.random() * politicalTraits.length)]!);

  // 60% chance for economic trait
  if (rng.random() < 0.6) {
    traits.push(economicTraits[Math.floor(rng.random() * economicTraits.length)]!);
  }

  // 60% chance for social trait
  if (rng.random() < 0.6) {
    traits.push(socialTraits[Math.floor(rng.random() * socialTraits.length)]!);
  }

  // 40% chance for psychological trait
  if (rng.random() < 0.4) {
    traits.push(psychologicalTraits[Math.floor(rng.random() * psychologicalTraits.length)]!);
  }

  // Ensure at least 2 traits
  while (traits.length < 2) {
    const allTraits = [
      ...economicTraits,
      ...socialTraits,
      ...psychologicalTraits,
    ];
    const newTrait = allTraits[Math.floor(rng.random() * allTraits.length)]!;
    if (!traits.includes(newTrait)) {
      traits.push(newTrait);
    }
  }

  // Star type influences: adjust some probabilities
  // Blue Giants tend to be Ambitious and Industrial
  if (starType === StarType.BlueGiant && rng.random() < 0.3) {
    if (!traits.includes(Trait.Ambitious)) {
      traits.push(Trait.Ambitious);
    }
  }

  // Red Dwarfs tend to be Cautious and Stoic
  if (starType === StarType.RedDwarf && rng.random() < 0.3) {
    if (!traits.includes(Trait.Stoic)) {
      traits.push(Trait.Stoic);
    }
  }

  // Limit to 3 traits max
  return traits.slice(0, 3);
}
