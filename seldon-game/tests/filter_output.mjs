import { createInterface } from 'readline';
const rl = createInterface({ input: process.stdin });
rl.on('line', l => {
  if (!l.includes('pairs checked') && !l.includes('Total alliances')) {
    console.log(l);
  }
});
