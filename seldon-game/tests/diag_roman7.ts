import { runRiseFallDiagnosticCli } from './rise-fall-diagnostic.js';

console.log('[INFO] diag_roman7 is deprecated; using the shared rise-fall lifecycle diagnostic.');
runRiseFallDiagnosticCli(process.argv.slice(2));
