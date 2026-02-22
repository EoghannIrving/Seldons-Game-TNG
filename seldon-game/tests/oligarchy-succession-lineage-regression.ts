import { resolveSuccession } from '../src/core/government';
import { updateDynastyAges } from '../src/core/psychohistory';
import { GovernmentType } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  // Case 1: normal board rotation with an alternate dynast.
  const star: any = {
    id: 'star_1',
    name: 'Tyrann',
    governmentType: GovernmentType.Oligarchy,
    currentDynastId: 'dynast-current',
    history: [],
    stability: 0.9,
    traits: [],
    _rotationStartPhase: 0,
    _rotationLength: 1,
  };

  const currentDynast: any = {
    id: 'dynast-current',
    dynastyId: 'dynasty-1',
    name: 'Dren Lumenton',
    birthPhase: 0,
  };
  const successorDynast: any = {
    id: 'dynast-successor',
    dynastyId: 'dynasty-1',
    name: 'Sera Lumenton',
    birthPhase: 5,
  };

  const state: any = {
    phase: 2,
    config: { seed: 12345 },
    dynasts: new Map([
      [currentDynast.id, currentDynast],
      [successorDynast.id, successorDynast],
    ]),
    dynasties: new Map([
      ['dynasty-1', { id: 'dynasty-1', houseName: 'House Lumenton' }],
    ]),
    dynasticRelationships: [],
    dynastySuccessionRecords: [],
    governmentHistory: new Map([
      [star.id, [{ governmentType: GovernmentType.Oligarchy, startPhase: 0, houseName: 'House Lumenton', successionCount: 0 }]],
    ]),
  };

  const result = resolveSuccession(star, state);
  assert(result === 'board_rotation', 'Expected oligarchy rotation to trigger board_rotation');
  assert(star.currentDynastId === successorDynast.id, 'Expected successor to become current dynast');
  assert(currentDynast.deathPhase === undefined, 'Board rotation should not mark outgoing dynast as dead');

  assert(state.dynastySuccessionRecords.length === 1, 'Expected one succession record');
  const record = state.dynastySuccessionRecords[0];
  assert(record.reason === 'board_rotation', 'Succession record should use board_rotation reason');
  assert(record.fromDynastId === currentDynast.id, 'Succession record should preserve outgoing dynast ID');
  assert(record.toDynastId === successorDynast.id, 'Succession record should preserve incoming dynast ID');
  assert(record.fromDynastId !== record.toDynastId, 'Outgoing and incoming dynast IDs must differ on rotation');

  const regimeHistory = state.governmentHistory.get(star.id);
  assert(regimeHistory?.[0]?.successionCount === 1, 'Regime succession counter should increment');

  // Case 2: no alternate board member available -> no-op (no bogus A -> A succession record).
  const soloStar: any = {
    id: 'star_2',
    name: 'Solo',
    governmentType: GovernmentType.Oligarchy,
    currentDynastId: 'dynast-solo',
    history: [],
    stability: 0.9,
    traits: [],
    _rotationStartPhase: 0,
    _rotationLength: 1,
  };
  const soloDynast: any = {
    id: 'dynast-solo',
    dynastyId: 'dynasty-2',
    name: 'Only Councillor',
    birthPhase: 0,
  };
  const soloState: any = {
    phase: 2,
    config: { seed: 999 },
    dynasts: new Map([[soloDynast.id, soloDynast]]),
    dynasties: new Map([['dynasty-2', { id: 'dynasty-2', houseName: 'House Solo' }]]),
    dynasticRelationships: [],
    dynastySuccessionRecords: [],
    governmentHistory: new Map([
      [soloStar.id, [{ governmentType: GovernmentType.Oligarchy, startPhase: 0, houseName: 'House Solo', successionCount: 0 }]],
    ]),
  };

  const soloResult = resolveSuccession(soloStar, soloState);
  assert(soloResult === null, 'Expected no board_rotation when no alternate board member exists');
  assert(soloStar.currentDynastId === soloDynast.id, 'Current dynast should remain unchanged for no-op rotation');
  assert(soloState.dynastySuccessionRecords.length === 0, 'No-op rotation must not log a succession record');
  assert(soloStar.history.length === 0, 'No-op rotation must not add a succession history event');
  assert(soloState.governmentHistory.get(soloStar.id)?.[0]?.successionCount === 0, 'No-op rotation must not increment regime succession count');

  // Case 3: oligarchies should grow a board pool over time (separate from heir generation)
  // so real board rotations can occur in normal simulation.
  const evolvingStar: any = {
    id: 'star_3',
    name: 'Council Prime',
    ruler: 'star_3',
    governmentType: GovernmentType.Oligarchy,
    currentDynastId: 'dynast-founder',
    dynastyAge: 0,
    history: [],
    stability: 0.9,
    traits: [],
    subjects: [],
  };
  const evolvingFounder: any = {
    id: 'dynast-founder',
    dynastyId: 'dynasty-3',
    name: 'Founder Councillor',
    birthPhase: 0,
    homeStarId: evolvingStar.id,
    traits: [],
    titles: ['Founder'],
    isLegitimized: true,
    isBastard: false,
  };
  const evolvingState: any = {
    phase: 0,
    config: { seed: 2026, starCount: 1, interactionFactor: 1 },
    stars: new Map([[evolvingStar.id, evolvingStar]]),
    dynasties: new Map([
      ['dynasty-3', {
        id: 'dynasty-3',
        houseName: 'House Lumenton',
        foundingPhase: 0,
        founderDynastId: evolvingFounder.id,
        cultureTags: [],
        dynastyTraits: [],
      }],
    ]),
    dynasts: new Map([[evolvingFounder.id, evolvingFounder]]),
    dynasticRelationships: [],
    dynastySuccessionRecords: [],
    activeCrises: [],
    governmentHistory: new Map([
      [evolvingStar.id, [{ governmentType: GovernmentType.Oligarchy, startPhase: 0, houseName: 'House Lumenton', successionCount: 0 }]],
    ]),
  };

  for (let phase = 0; phase < 80; phase++) {
    evolvingState.phase = phase;
    updateDynastyAges(evolvingState);
  }

  const livingAlternates = Array.from(evolvingState.dynasts.values()).filter((d: any) =>
    d.dynastyId === 'dynasty-3' && d.id !== evolvingStar.currentDynastId && !d.deathPhase
  );
  assert(livingAlternates.length >= 1, 'Oligarchy should generate at least one alternate council member over time');
  assert(
    evolvingState.dynastySuccessionRecords.some((r: any) => r.reason === 'board_rotation'),
    'Oligarchy should eventually log a real board rotation once alternates exist'
  );

  // Case 4: current oligarch should eventually die of age (not just rotate forever).
  const agingStar: any = {
    id: 'star_4',
    name: 'Aging Council',
    governmentType: GovernmentType.Oligarchy,
    currentDynastId: 'dynast-elder',
    history: [],
    stability: 0.9,
    traits: [],
    _rotationStartPhase: 0,
    _rotationLength: 999, // not rotation due; death should still trigger turnover
  };
  const elder: any = {
    id: 'dynast-elder',
    dynastyId: 'dynasty-4',
    name: 'Elder Lumenton',
    birthPhase: -200, // guaranteed over lifespan threshold by a large margin
  };
  const younger: any = {
    id: 'dynast-younger',
    dynastyId: 'dynasty-4',
    name: 'Younger Lumenton',
    birthPhase: 0,
  };
  const agingState: any = {
    phase: 50,
    config: { seed: 77 },
    dynasts: new Map([
      [elder.id, elder],
      [younger.id, younger],
    ]),
    dynasties: new Map([
      ['dynasty-4', { id: 'dynasty-4', houseName: 'House Lumenton' }],
    ]),
    dynasticRelationships: [],
    dynastySuccessionRecords: [],
    governmentHistory: new Map([
      [agingStar.id, [{ governmentType: GovernmentType.Oligarchy, startPhase: 0, houseName: 'House Lumenton', successionCount: 0 }]],
    ]),
  };

  const agingResult = resolveSuccession(agingStar, agingState);
  assert(agingResult === 'board_rotation', 'Expected old oligarch death to trigger a board turnover');
  assert(elder.deathPhase === agingState.phase, 'Aging oligarch should be marked dead');
  assert(agingStar.currentDynastId === younger.id, 'A living alternate should replace a dead oligarch');
  assert(agingState.dynastySuccessionRecords.length === 1, 'Death turnover should log one succession record');
  assert(agingState.dynastySuccessionRecords[0].fromDynastId === elder.id, 'Death turnover should record outgoing elder');
  assert(agingState.dynastySuccessionRecords[0].toDynastId === younger.id, 'Death turnover should record incoming councilor');

  console.log('[PASS] oligarchy-succession-lineage-regression');
}

main();
