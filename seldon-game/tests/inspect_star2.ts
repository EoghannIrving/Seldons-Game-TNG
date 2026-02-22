import { Galaxy } from '../src/core/galaxy.js';
const galaxy = new Galaxy({ seed: 42, size: 'medium' as any, shape: 'spiral' as any, interactionFactor: 10 });
for (let i = 0; i < 10; i++) galaxy.advancePhase();
const stars = galaxy.state.stars as Map<any,any>;
let count = 0;
for (const star of stars.values()) {
  if (count >= 3) break;
  console.log(JSON.stringify({ id: star.id, name: star.name, tier: star.tier, ruler: star.ruler, subjectCount: star.subjects?.length }));
  count++;
}
console.log('Total stars:', stars.size);
// Count rulers
let rulers = 0;
let minors = 0;
let nullRulers = 0;
for (const star of stars.values()) {
  if (star.tier === 'minor') { minors++; continue; }
  if (star.ruler === star.id) rulers++;
  if (star.ruler === null) nullRulers++;
}
console.log('Major rulers (ruler===id):', rulers, '| null rulers:', nullRulers, '| minor:', minors);
