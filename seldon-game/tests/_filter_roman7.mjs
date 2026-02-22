import { readFileSync } from 'fs';
const text = readFileSync(process.argv[2], 'utf8');
const lines = text.split('\n');
const keep = lines.filter(l => {
  const t = l.trimStart();
  if (t.startsWith('Phase ')) return false; // skip alliance log lines
  return (
    t.startsWith('Seed') ||
    t.startsWith('Peak') ||
    t.startsWith('Longest') ||
    t.startsWith('Ph')   // checkpoint lines like Ph50: ...
  );
});
console.log(keep.join('\n'));
