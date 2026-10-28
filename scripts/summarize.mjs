// Aggregates recorded tier-benchmark runs: mean and sample SD across seeds per tier, plus offline routing policies.
// CLI: node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --out experiments/E02/summary-combined.json
// Runs stopped by the application token ledger before reaching the model (NOT_EXECUTED) are replaced by a later run of the same cell.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {MODELS,LADDER} from '../server/models.mjs';
import {evaluatePolicy} from '../server/ladder.mjs';
export const NOT_EXECUTED=new Set(['token_accounting_unknown','token_budget_overrun','token_budget_exhausted']);
// An error code alone cannot prove that no provider call was attempted.
export const isNotExecuted=r=>NOT_EXECUTED.has(r?.error)&&Array.isArray(r.calls)&&r.calls.length===0;
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const sd=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)):null;
export function summarize(results,{tiers,seeds,profiles,tasks,...meta}){
 const summary={generatedAt:new Date().toISOString(),...meta,tiers,seeds,profiles,tasks,byTier:{},policies:{}};
 for(const tier of tiers){
  const rs=results.filter(r=>r.tier===tier);const perSeed=seeds.map(s=>rs.filter(r=>r.inference.seed===s)).filter(g=>g.length);
  summary.byTier[tier]={model:MODELS[tier].id,runs:rs.length,passRate:{mean:mean(perSeed.map(g=>g.filter(r=>r.status==='passed').length/g.length)),sd:sd(perSeed.map(g=>g.filter(r=>r.status==='passed').length/g.length))},
   durationMs:{mean:mean(rs.map(r=>r.durationMs)),sd:sd(rs.map(r=>r.durationMs))},tokens:{mean:mean(rs.filter(r=>r.tokens!==null).map(r=>r.tokens))},costUSD:{mean:mean(rs.filter(r=>Number.isFinite(r.cost)).map(r=>r.cost)),known:rs.every(r=>Number.isFinite(r.cost)),knownRuns:rs.filter(r=>Number.isFinite(r.cost)).length,totalRuns:rs.length},errors:rs.filter(r=>r.status==='error').map(r=>r.error)};
 }
 if(LADDER.every(t=>tiers.includes(t))){
  const cells=[];for(const seed of seeds)for(const task of tasks)for(const profile of profiles){const grid=Object.fromEntries(LADDER.map(t=>[t,results.find(r=>r.tier===t&&r.taskId===task&&r.profile===profile&&r.inference.seed===seed)]));if(LADDER.every(t=>grid[t]))cells.push({seed,task,profile,ladder:evaluatePolicy(grid),ultra:grid.ultra,super:grid.super});}
  const pol=(name,pick)=>{const per=seeds.map(s=>cells.filter(c=>c.seed===s).map(pick)).filter(g=>g.length);const costs=cells.map(pick).map(x=>x.cost).filter(Number.isFinite);summary.policies[name]={passRate:{mean:mean(per.map(g=>g.filter(x=>x.passed).length/g.length)),sd:sd(per.map(g=>g.filter(x=>x.passed).length/g.length))},costUSD:mean(costs),costCoverage:{knownCells:costs.length,totalCells:cells.length,complete:costs.length===cells.length},durationMs:mean(cells.map(pick).map(x=>x.durationMs))};};
  pol('ladder',c=>({passed:!!c.ladder.chosenTier,cost:c.ladder.cost,durationMs:c.ladder.durationMs}));
  pol('always_ultra',c=>({passed:c.ultra.status==='passed',cost:c.ultra.cost,durationMs:c.ultra.durationMs}));
  pol('always_super',c=>({passed:c.super.status==='passed',cost:c.super.cost,durationMs:c.super.durationMs}));
  summary.pairedCostComparisons={};
  for(const name of ['ultra','super']){
   const paired=cells.filter(c=>Number.isFinite(c.ladder.cost)&&Number.isFinite(c[name].cost));
   const a=mean(paired.map(c=>c.ladder.cost)),b=mean(paired.map(c=>c[name].cost));
   summary.pairedCostComparisons['ladder_vs_always_'+name]={knownPairs:paired.length,totalCells:cells.length,ladderMeanUSD:a,controlMeanUSD:b,deltaMeanUSD:a===null||b===null?null:a-b,relativeSaving:a===null||!b?null:1-a/b,excludedCells:cells.filter(c=>!Number.isFinite(c.ladder.cost)||!Number.isFinite(c[name].cost)).map(c=>({seed:c.seed,task:c.task,profile:c.profile}))};
  }
  summary.cells=cells.map(c=>({seed:c.seed,task:c.task,profile:c.profile,chosenTier:c.ladder.chosenTier,path:c.ladder.path}));
 }
 return summary;
}
// Later directories win for a cell only when the earlier run never reached the model.
export function mergeRuns(dirs,{recoverLedgerFailures=false,audit=null}={}){
 const byCell=new Map();
 if(audit)Object.assign(audit,{historyRuns:0,providerAttemptedRuns:0,replacements:[],analysis:recoverLedgerFailures?'infrastructure_recovery_secondary':'first_provider_attempt_preserved'});
 for(const dir of dirs)for(const f of readdirSync(dir).filter(f=>f.endsWith('.json'))){
  const r=JSON.parse(readFileSync(join(dir,f),'utf8'));const key=[r.tier,r.taskId,r.profile,r.inference.seed].join('|');const prev=byCell.get(key);
  if(audit){audit.historyRuns++;if(r.calls?.length)audit.providerAttemptedRuns++;}
  if(!prev||isNotExecuted(prev)||(recoverLedgerFailures&&NOT_EXECUTED.has(prev.error))){
   if(prev&&audit)audit.replacements.push({cell:key,previousId:prev.id,nextId:r.id,previousProviderCalls:prev.calls?.length??null,reason:isNotExecuted(prev)?'no_provider_attempt':'explicit_secondary_recovery'});
   byCell.set(key,r);
  }
 }
 return [...byCell.values()];
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=n=>{const i=process.argv.indexOf('--'+n);return i>0?process.argv[i+1]:null;};
 const mergeAudit={};const results=mergeRuns(arg('runs').split(','),{recoverLedgerFailures:process.argv.includes('--recover-ledger-failures'),audit:mergeAudit});const uniq=k=>[...new Set(results.map(k))].sort((a,b)=>a<b?-1:1);
 const s=summarize(results,{tiers:LADDER.filter(t=>results.some(r=>r.tier===t)),seeds:uniq(r=>r.inference.seed),profiles:uniq(r=>r.profile),tasks:uniq(r=>r.taskId),sources:arg('runs').split(','),maxTokens:results[0]?.inference.maxTokens,notExecuted:results.filter(isNotExecuted).length,mergeAudit});
 writeFileSync(arg('out'),JSON.stringify(s,null,2));console.log(JSON.stringify({byTier:s.byTier,policies:s.policies,notExecuted:s.notExecuted},null,1));
}
