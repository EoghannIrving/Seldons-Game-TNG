
import { Galaxy } from './core/galaxy';
import { GalaxyConfig, GalaxyShape, StarTier } from './core/types';

// Mock console.log to keep output clean or just use it
const log = console.log;

function runTest() {
  log("Starting Phase 6 Test: Dynamic Tiers");

  const config: GalaxyConfig = {
    seed: 12345,
    starCount: 200,
    interactionFactor: 1000,
    shape: GalaxyShape.Spiral,
    width: 1000,
    height: 800,
    tierDistribution: {
      major: 0.05,    // 10 stars
      regional: 0.20, // 40 stars
      // Minor: 150 stars
    }
  };

  const galaxy = new Galaxy(config);
  
  // Check initial distribution
  const initialCounts: Record<string, number> = {
    [StarTier.Major]: 0,
    [StarTier.Regional]: 0,
    [StarTier.Minor]: 0,
  };

  for (const star of galaxy.state.stars.values()) {
    initialCounts[star.tier] = (initialCounts[star.tier] || 0) + 1;
  }

  log("Initial Distribution (Phase 0):");
  log(JSON.stringify(initialCounts, null, 2));

  // Run for 20 phases to trigger updateStarTiers (at phase 10 and 20)
  log("Advancing 20 phases...");
  const initialTiers = new Map<string, StarTier>();
  for (const star of galaxy.state.stars.values()) {
    initialTiers.set(star.id, star.tier);
  }

  // advancePhase increments phase at the end.
  // We want to reach phase 20.
  // Initial phase is 0.
  for (let i = 0; i < 20; i++) {
    galaxy.advancePhase();
  }

  log(`Current Phase: ${galaxy.state.phase}`);

  // Check final distribution
  const finalCounts: Record<string, number> = {
    [StarTier.Major]: 0,
    [StarTier.Regional]: 0,
    [StarTier.Minor]: 0,
  };

  let changes = 0;
  for (const star of galaxy.state.stars.values()) {
    finalCounts[star.tier] = (finalCounts[star.tier] || 0) + 1;
    if (initialTiers.get(star.id) !== star.tier) {
      changes++;
    }
  }

  log("Final Distribution (Phase 20):");
  log(JSON.stringify(finalCounts, null, 2));
  log(`Total Tier Changes: ${changes}`);

  // Validation
  const total = 200;
  const expectedMajor = Math.floor(total * 0.05); // 10
  const expectedRegional = Math.floor(total * 0.20); // 40
  
  // Since updateStarTiers enforces exact counts (or close to it due to sorting):
  // Major should be exactly 10
  // Regional should be exactly 40
  
  if (finalCounts[StarTier.Major] !== expectedMajor) {
    console.error(`FAIL: Expected ${expectedMajor} Major stars, got ${finalCounts[StarTier.Major]}`);
  } else {
    log("PASS: Major star count is correct.");
  }

  if (finalCounts[StarTier.Regional] !== expectedRegional) {
    console.error(`FAIL: Expected ${expectedRegional} Regional stars, got ${finalCounts[StarTier.Regional]}`);
  } else {
    log("PASS: Regional star count is correct.");
  }
}

runTest();
