// Aggregates recorded tier-benchmark runs: mean and sample SD across seeds per tier, plus offline routing policies.
// CLI: node scripts/summarize.mjs --runs experiments/E02/runs,experiments/E02b/runs --out experiments/E02/summary-combined.json
// Runs stopped by the application token ledger before reaching the model (NOT_EXECUTED) are replaced by a later run of the same cell.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {MODELS,LADDER} from '../server/models.mjs';
import {evaluatePolicy,evaluateSpeculative} from '../server/ladder.mjs';
export const NOT_EXECUTED=new Set(['token_accounting_unknown','token_budget_overrun','token_budget_exhausted']);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const sd=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)):null;
export function summarize(results,{tiers,seeds,profiles,tasks,...meta}){
 const summary={generatedAt:new Date().toISOString(),...meta,tiers,seeds,profiles,tasks,byTier:{},policies:{}};
 for(const tier of tiers){
  // Runs stopped by the ledger before reaching the model are missing data, not failures (E03 rule: judge on complete cells only).
  const rs=results.filter(r=>r.tier===tier&&!NOT_EXECUTED.has(r.error));const perSeed=seeds.map(s=>rs.filter(r=>r.inference.seed===s)).filter(g=>g.length);
  summary.byTier[tier]={model:MODELS[tier].id,runs:rs.length,passRate:{mean:mean(perSeed.map(g=>g.filter(r=>r.status==='passed').length/g.length)),sd:sd(perSeed.map(g=>g.filter(r=>r.status==='passed').length/g.length))},
   durationMs:{mean:mean(rs.map(r=>r.durationMs)),sd:sd(rs.map(r=>r.durationMs))},tokens:{mean:mean(rs.filter(r=>r.tokens!==null).map(r=>r.tokens))},costUSD:{mean:mean(rs.filter(r=>r.cost!==null).map(r=>r.cost)),known:rs.every(r=>r.cost!==null)},errors:rs.filter(r=>r.status==='error').map(r=>r.error)};
 }
 if(LADDER.every(t=>tiers.includes(t))){
  // Tier memory (E03 H8): seeds are taken in ascending order as time; a task and profile start at the tier that resolved their latest earlier seed, else at Lightning.
  const cells=[],memory=new Map();for(const seed of [...seeds].sort((a,b)=>a-b))for(const task of tasks)for(const profile of profiles){const grid=Object.fromEntries(LADDER.map(t=>[t,results.find(r=>r.tier===t&&r.taskId===task&&r.profile===profile&&r.inference.seed===seed)]));if(!LADDER.every(t=>grid[t]&&!NOT_EXECUTED.has(grid[t].error)))continue;
   const key=task+'|'+profile,start=memory.get(key)||LADDER[0],remembered=evaluatePolicy(grid,LADDER.slice(LADDER.indexOf(start)));if(remembered.chosenTier)memory.set(key,remembered.chosenTier);
   cells.push({seed,task,profile,ladder:evaluatePolicy(grid),speculative:evaluateSpeculative(grid),memory:{...remembered,startTier:start},ultra:grid.ultra,super:grid.super});}
  const pol=(name,pick)=>{const per=seeds.map(s=>cells.filter(c=>c.seed===s).map(pick)).filter(g=>g.length);const all=cells.map(pick);summary.policies[name]={passRate:{mean:mean(per.map(g=>g.filter(x=>x.passed).length/g.length)),sd:sd(per.map(g=>g.filter(x=>x.passed).length/g.length))},costUSD:mean(all.map(x=>x.cost).filter(Number.isFinite)),durationMs:mean(all.map(x=>x.durationMs)),durationMsMedian:median(all.map(x=>x.durationMs)),durationMsMax:all.length?Math.max(...all.map(x=>x.durationMs)):null,cells:all.length};};
  pol('ladder',c=>({passed:!!c.ladder.chosenTier,cost:c.ladder.cost,durationMs:c.ladder.durationMs}));
  pol('always_ultra',c=>({passed:c.ultra.status==='passed',cost:c.ultra.cost,durationMs:c.ultra.durationMs}));
  pol('always_super',c=>({passed:c.super.status==='passed',cost:c.super.cost,durationMs:c.super.durationMs}));
  pol('speculative',c=>({passed:!!c.speculative.chosenTier,cost:c.speculative.cost,durationMs:c.speculative.durationMs}));
  pol('tier_memory',c=>({passed:!!c.memory.chosenTier,cost:c.memory.cost,durationMs:c.memory.durationMs}));
  summary.cells=cells.map(c=>({seed:c.seed,task:c.task,profile:c.profile,chosenTier:c.ladder.chosenTier,path:c.ladder.path,speculative:{chosenTier:c.speculative.chosenTier,path:c.speculative.path,durationMs:c.speculative.durationMs},memory:{startTier:c.memory.startTier,chosenTier:c.memory.chosenTier,path:c.memory.path}}));
 }
 return summary;
}
// Live speculative ladders (E03 part B). Halted cells completed later carry composedFrom; their answer time comes from the offline rule.
// predictedMs applies the offline rule to the runs a measured ladder made, so the latency model can be checked against the clock.
export function summarizeLadders(ladders,runsById){
 const cells=ladders.map(l=>{const grid=Object.fromEntries(l.steps.map(s=>[s.tier,runsById.get(s.runId)]).filter(([,r])=>r));const offline=evaluateSpeculative(grid);const composed=!!l.composedFrom;
  return {seed:l.seed,task:l.taskId,profile:l.profile,composed,status:composed?(offline.chosenTier?'resolved':'unresolved'):l.status,chosenTier:composed?offline.chosenTier:l.chosenTier,
   answerMs:composed?offline.durationMs:l.decisionMs,settledMs:composed?null:l.durationMs,predictedMs:offline.complete?offline.durationMs:null,cost:composed?offline.cost:l.cost,steps:l.steps.map(s=>`${s.tier}:${s.error||s.status}`)};});
 const seeds=[...new Set(cells.map(c=>c.seed))].sort((a,b)=>a-b),per=seeds.map(s=>cells.filter(c=>c.seed===s)),measured=cells.filter(c=>!c.composed&&c.predictedMs!==null);
 const rates=per.map(g=>g.filter(c=>c.chosenTier).length/g.length),answer=cells.map(c=>c.answerMs).filter(Number.isFinite);
 return {generatedAt:new Date().toISOString(),cells,aggregate:{cells:cells.length,composed:cells.filter(c=>c.composed).length,halted:cells.filter(c=>c.status==='halted').length,passRate:{mean:mean(rates),sd:sd(rates)},
  answerMs:{mean:mean(answer),median:median(answer),max:answer.length?Math.max(...answer):null},costUSD:mean(cells.map(c=>c.cost).filter(Number.isFinite)),costKnown:cells.every(c=>Number.isFinite(c.cost)),
  chosen:Object.fromEntries(LADDER.map(t=>[t,cells.filter(c=>c.chosenTier===t).length])),latencyModel:{cells:measured.length,meanAbsErrorMs:mean(measured.map(c=>Math.abs(c.answerMs-c.predictedMs))),meanSignedErrorMs:mean(measured.map(c=>c.answerMs-c.predictedMs))}}};
}
// Later directories win for a cell only when the earlier run never reached the model.
export function mergeRuns(dirs){
 const byCell=new Map();
 for(const dir of dirs)for(const f of readdirSync(dir).filter(f=>f.endsWith('.json'))){
  const r=JSON.parse(readFileSync(join(dir,f),'utf8'));const key=[r.tier,r.taskId,r.profile,r.inference.seed].join('|');const prev=byCell.get(key);
  if(!prev||NOT_EXECUTED.has(prev.error))byCell.set(key,r);
 }
 return [...byCell.values()];
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=n=>{const i=process.argv.indexOf('--'+n);return i>0?process.argv[i+1]:null;};
 const results=mergeRuns(arg('runs').split(','));const uniq=k=>[...new Set(results.map(k))].sort((a,b)=>a<b?-1:1);
 const s=summarize(results,{tiers:LADDER.filter(t=>results.some(r=>r.tier===t)),seeds:uniq(r=>r.inference.seed),profiles:uniq(r=>r.profile),tasks:uniq(r=>r.taskId),sources:arg('runs').split(','),maxTokens:results[0]?.inference.maxTokens,notExecuted:results.filter(r=>NOT_EXECUTED.has(r.error)).length});
 writeFileSync(arg('out'),JSON.stringify(s,null,2));console.log(JSON.stringify({byTier:s.byTier,policies:s.policies,notExecuted:s.notExecuted},null,1));
}
