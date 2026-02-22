import { resolveSuccession } from '../src/core/government';
import { GovernmentType } from '../src/core/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const star: any = {
    id: 'star_1',
    name: 'Rukbat',
    governmentType: GovernmentType.MilitaryJunta,
    currentDynastId: 'dynast-elder',
    history: [],
    stability: 0.9, // no coup path; death-only turnover for this test
    traits: [],
    administrativeTech: 0.2,
  };

  const elder: any = {
    id: 'dynast-elder',
    dynastyId: 'dynasty-1',
    name: 'Solan Vendormont',
    birthPhase: -200, // force deathChance > 1
    homeStarId: star.id,
    traits: [],
    titles: ['General'],
    isLegitimized: true,
    isBastard: false,
  };

  const state: any = {
    phase: 50,
    config: { seed: 1234 },
    dynasts: new Map([[elder.id, elder]]),
    dynasties: new Map([['dynasty-1', { id: 'dynasty-1', houseName: 'House Vendormont' }]]),
    dynasticRelationships: [], // no heir -> should generate officer successor
    dynastySuccessionRecords: [],
    governmentHistory: new Map([
      [star.id, [{ governmentType: GovernmentType.MilitaryJunta, startPhase: 0, houseName: 'House Vendormont', successionCount: 0 }]],
    ]),
  };

  const result = resolveSuccession(star, state);
  assert(result === 'appointment', 'Junta death without heir should produce appointment, not inheritance');
  assert(elder.deathPhase === state.phase, 'Actual death turnover should mark the outgoing junta ruler dead');
  assert(star.currentDynastId !== elder.id, 'Junta death turnover should replace the dead ruler');

  const successor = state.dynasts.get(star.currentDynastId);
  assert(successor, 'Junta death turnover should generate a successor officer');
  assert(successor.titles.includes('General'), 'Generated non-coup junta successor should be titled General');

  assert(state.dynastySuccessionRecords.length === 1, 'Expected one junta succession record');
  const record = state.dynastySuccessionRecords[0];
  assert(record.reason === 'appointment', 'Junta no-heir turnover should log appointment');
  assert(record.fromDynastId === elder.id, 'Succession record should preserve outgoing junta ruler ID');
  assert(record.toDynastId === star.currentDynastId, 'Succession record should preserve generated successor ID');
  assert(record.fromDynastId !== record.toDynastId, 'Junta succession should not log A -> A');

  const regime = state.governmentHistory.get(star.id)?.[0];
  assert(regime?.successionCount === 1, 'Junta regime succession counter should increment');

  console.log('[PASS] junta-succession-regression');
}

main();
