import { Galaxy } from '../src/core/galaxy';
import { updateAdministrativeTech } from '../src/core/history-mechanics';
import { GalaxyConfig, GalaxyShape, StarTier, Trait } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 60,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: {
      major: 0.05,
      regional: 0.2,
    },
  };
}

function testDarkAgeTechDecline(): void {
  const galaxy = new Galaxy(buildConfig(314159));
  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected at least one star');

  star!.tier = StarTier.Major;
  star!.administrativeTech = 90;
  star!.growth = 1.05;
  star!.centralization = 0.72;
  star!.stability = 0.38;
  star!.tradeRoutes = [];
  star!.atWarWith = [];
  star!.infrastructureDamage = 0.45;
  star!.subjects = new Array(8).fill('subj');
  star!.darkAge = true;
  star!.severeDarkAge = false;
  star!.traits = [
    Trait.Spiritualist,
    Trait.Traditionalist,
    Trait.Xenophobic,
    Trait.Cosmopolitan,
    Trait.Industrial,
    Trait.Cautious,
    Trait.Volatile,
  ];

  const before = star!.administrativeTech;
  updateAdministrativeTech(star!, galaxy.state);
  const after = star!.administrativeTech;
  assert(after < before, 'Dark age + anti-tech traits should produce net tech decline');
}

function testPenaltyCapGuardrail(): void {
  const galaxy = new Galaxy(buildConfig(271828));
  const star = galaxy.getAllStars()[0];
  assert(star, 'Expected at least one star');

  star!.tier = StarTier.Major;
  star!.administrativeTech = 75;
  star!.growth = 0.95;
  star!.centralization = 0.68;
  star!.stability = 0.30;
  star!.tradeRoutes = [];
  star!.atWarWith = ['a', 'b'];
  star!.infrastructureDamage = 0.6;
  star!.subjects = new Array(10).fill('subj');
  star!.darkAge = false;
  star!.severeDarkAge = false;
  star!.traits = Object.values(Trait);

  const before = star!.administrativeTech;
  updateAdministrativeTech(star!, galaxy.state);
  const delta = before - star!.administrativeTech;
  assert(delta <= 0.08, 'Trait-only tech penalty should be capped at 0.08 per phase');
}

function main(): void {
  testDarkAgeTechDecline();
  testPenaltyCapGuardrail();
  console.log('[PASS] tech-drift-smoke');
}

main();
