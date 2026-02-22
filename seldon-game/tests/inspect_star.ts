import { Galaxy } from '../src/core/galaxy.js';
const galaxy = new Galaxy({ seed: 42, size: 'medium' as any, shape: 'spiral' as any, interactionFactor: 10 });
galaxy.advancePhase();
const stars = galaxy.state.stars as Map<any,any>;
const sample = [...stars.values()].slice(0, 2);
for (const s of sample) {
  console.log('KEYS:', Object.keys(s).join(', '));
  console.log('SAMPLE:', JSON.stringify(s));
  break;
}
