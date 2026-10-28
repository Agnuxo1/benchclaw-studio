// Count provider attempts separately from ledger-only placeholders; no inference calls.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const sources=['experiments/E01/runs','experiments/E02/runs','experiments/E02b/runs'];
const records=sources.flatMap(dir=>readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(dir+'/'+f,'utf8'))));
const attempted=records.filter(r=>Array.isArray(r.calls)&&r.calls.length>0);
const known=attempted.filter(r=>Number.isFinite(r.cost));
const report={sources,totalStoredRecords:records.length,providerAttemptedRuns:attempted.length,ledgerOnlyRecords:records.length-attempted.length,knownCostAttemptedRuns:known.length,unknownCostAttemptedRuns:attempted.length-known.length,knownEstimatedCostUSD:known.reduce((s,r)=>s+r.cost,0),costBasis:'Recorded provider tokens times recorded catalogue prices; unknown usage is excluded, not zero and not a final invoice.',attemptedLedgerFailures:attempted.filter(r=>['token_budget_overrun','token_accounting_unknown'].includes(r.error)).map(r=>({id:r.id,tier:r.tier,task:r.taskId,profile:r.profile,seed:r.inference.seed,calls:r.calls.length,cost:r.cost}))};
writeFileSync('experiments/history-audit-20261028.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
