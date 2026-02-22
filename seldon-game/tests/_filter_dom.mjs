import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const file = process.argv[2];
if (!file) { console.error('Usage: node _filter_dom.mjs <file>'); process.exit(1); }

const rl = createInterface({ input: createReadStream(file) });
rl.on('line', (line) => {
  if (!line.includes('pairs checked')) {
    console.log(line);
  }
});
