// Thin wrapper: delegate to tsx so TypeScript source is used directly
import { execSync } from 'child_process';

const result = execSync(
  'npx tsx diag_dominance_impl.ts',
  {
    cwd: 'C:\Users\eogha\Downloads\Seldons Game TNG\seldon-game',
    encoding: 'utf8',
    stdio: 'pipe'
  }
);
process.stdout.write(result);
