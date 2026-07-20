import { runRiseFallDiagnosticCli } from './rise-fall-diagnostic.js';

console.log('[INFO] diag:tuning is deprecated; using diag:rise-fall lifecycle metrics.');
runRiseFallDiagnosticCli(process.argv.slice(2));
