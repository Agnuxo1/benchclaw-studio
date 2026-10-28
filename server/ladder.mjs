import {randomUUID} from 'node:crypto';
import {makeRun,executeRun} from './engine.mjs';
import {MODELS,LADDER} from './models.mjs';
// Errors that say nothing about the model's ability to do the task: escalating would only spend more.
const HALT=new Set(['cancelled','credentials_missing','authentication_failed','rate_limited','token_budget_exhausted','token_accounting_unknown','token_budget_overrun','storage_error']);
export const POLICIES=['sequential','speculative'];
export function makeLadder(taskId,profile,allowedTools,owner,{seed=null,tiers=LADDER,policy='sequential'}={}){
 if(!POLICIES.includes(policy)||!Array.isArray(tiers)||!tiers.length||tiers.some(t=>!Object.hasOwn(MODELS,t))||new Set(tiers).size!==tiers.length)throw new Error('invalid_configuration');
 makeRun(taskId,profile,allowedTools,owner,MODELS[tiers[0]].id);
 return {id:randomUUID(),owner,taskId,profile,allowedTools:[...new Set(allowedTools)],tiers:[...tiers],policy,seed:Number.isSafeInteger(seed)?seed:null,status:'queued',chosenTier:null,steps:[],cost:null,durationMs:null,createdAt:new Date().toISOString()};
}
// Run the cheapest tier first and escalate only when its deterministic checks fail.
export async function executeLadder(ladder,client,{signal,register=()=>{},persist=async()=>{},persistLadder=async()=>{},health}={}){
 const started=performance.now();ladder.status='running';await persistLadder(ladder);
 try{
  for(const tier of ladder.tiers){
   if(signal?.aborted){ladder.status='cancelled';break;}
   const run=makeRun(ladder.taskId,ladder.profile,ladder.allowedTools,ladder.owner,MODELS[tier].id,{seed:ladder.seed,ladderId:ladder.id});
   register(run);const step={tier,runId:run.id,status:'running',cost:null,tokens:null,durationMs:null};ladder.steps.push(step);await persistLadder(ladder);
   await executeRun(run,client,{signal,persist,health});
   Object.assign(step,{status:run.status,error:run.error,cost:run.cost,tokens:run.tokens,durationMs:run.durationMs,checks:run.result?`${run.result.passedCount}/${run.result.total}`:null});
   if(run.status==='passed'){ladder.chosenTier=tier;break;}
   if(run.status==='cancelled'||HALT.has(run.error)){ladder.status=run.status==='cancelled'?'cancelled':'halted';break;}
  }
  if(ladder.status==='running')ladder.status=ladder.chosenTier?'resolved':'unresolved';
 }finally{
  const costs=ladder.steps.map(s=>s.cost);ladder.cost=costs.length&&costs.every(Number.isFinite)?costs.reduce((a,b)=>a+b,0):null;
  ladder.durationMs=Math.round(performance.now()-started);ladder.decisionMs=ladder.durationMs;await persistLadder(ladder);
 }
 return ladder;
}
// Speculative ladder (E03): start the two cheapest tiers together and answer with the first run that passes; the rest of the ladder runs only if both fail.
// Parallel runs are never cancelled once one passes, so every call is reconciled by the token ledger; decisionMs is when the answer is known, durationMs when all runs settled.
export async function executeSpeculativeLadder(ladder,client,{signal,register=()=>{},persist=async()=>{},persistLadder=async()=>{},health}={}){
 const started=performance.now();ladder.status='running';ladder.decisionMs=null;await persistLadder(ladder);
 const start=tier=>{const run=makeRun(ladder.taskId,ladder.profile,ladder.allowedTools,ladder.owner,MODELS[tier].id,{seed:ladder.seed,ladderId:ladder.id});register(run);const step={tier,runId:run.id,status:'running',cost:null,tokens:null,durationMs:null};ladder.steps.push(step);return {run,step};};
 const settle=({run,step})=>Object.assign(step,{status:run.status,error:run.error,cost:run.cost,tokens:run.tokens,durationMs:run.durationMs,checks:run.result?`${run.result.passedCount}/${run.result.total}`:null});
 // The decision is persisted as soon as it is known, so a client polling the ladder sees the answer before the slower run settles.
 let saving=Promise.resolve();const decide=(tier,status)=>{if(ladder.decisionMs!==null)return;ladder.decisionMs=Math.round(performance.now()-started);ladder.chosenTier=tier;ladder.status=status;saving=saving.then(()=>persistLadder(ladder)).catch(()=>{});};
 const stopped=run=>run.status==='cancelled'||HALT.has(run.error);
 try{
  const parallel=ladder.tiers.slice(0,2).map(start);await persistLadder(ladder);
  await Promise.all(parallel.map(async p=>{await executeRun(p.run,client,{signal,persist,health});settle(p);if(p.run.status==='passed')decide(p.step.tier,'resolved');}));
  if(ladder.decisionMs===null){
   const halt=parallel.find(p=>stopped(p.run));
   if(halt)decide(null,halt.run.status==='cancelled'?'cancelled':'halted');
   else for(const tier of ladder.tiers.slice(2)){
    if(signal?.aborted){decide(null,'cancelled');break;}
    const p=start(tier);await persistLadder(ladder);await executeRun(p.run,client,{signal,persist,health});settle(p);
    if(p.run.status==='passed'){decide(tier,'resolved');break;}
    if(stopped(p.run)){decide(null,p.run.status==='cancelled'?'cancelled':'halted');break;}
   }
   decide(null,'unresolved');
  }
 }finally{
  const costs=ladder.steps.map(s=>s.cost);ladder.cost=costs.length&&costs.every(Number.isFinite)?costs.reduce((a,b)=>a+b,0):null;
  ladder.durationMs=Math.round(performance.now()-started);if(ladder.decisionMs===null){ladder.decisionMs=ladder.durationMs;if(ladder.status==='running')ladder.status='halted';}await saving;await persistLadder(ladder);
 }
 return ladder;
}
// Offline counterpart of the speculative ladder on a full tier grid. Parallel runs are assumed to take their recorded durations.
// Answer time: the earliest finish among the passing parallel runs (cheaper tier on a tie); if both fail, the slower of the two plus the remaining tiers in order.
export function evaluateSpeculative(grid,tiers=LADDER){
 const par=tiers.slice(0,2);if(par.some(t=>!grid[t]))return {chosenTier:null,path:[],cost:null,durationMs:null,complete:false};
 const path=[...par];let cost=0,known=true;const add=r=>{if(Number.isFinite(r.cost))cost+=r.cost;else known=false;};par.forEach(t=>add(grid[t]));
 const passing=par.filter(t=>grid[t].status==='passed').sort((a,b)=>(grid[a].durationMs||0)-(grid[b].durationMs||0)||par.indexOf(a)-par.indexOf(b));
 if(passing.length)return {chosenTier:passing[0],path,cost:known?cost:null,durationMs:grid[passing[0]].durationMs||0,complete:true};
 let durationMs=Math.max(...par.map(t=>grid[t].durationMs||0));
 // Same halt rule as the live speculative ladder: a stopped parallel run, or a stopped later tier, ends the ladder.
 const stopped=r=>r.status==='cancelled'||HALT.has(r.error);
 if(par.some(t=>stopped(grid[t])))return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true,halted:true};
 for(const tier of tiers.slice(2)){const r=grid[tier];if(!r)return {chosenTier:null,path,cost:null,durationMs:null,complete:false};path.push(tier);add(r);durationMs+=r.durationMs||0;if(r.status==='passed')return {chosenTier:tier,path,cost:known?cost:null,durationMs,complete:true};if(stopped(r))return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true,halted:true};}
 return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true};
}
// Offline policy evaluation over a full tier grid: which tier would the ladder pick, and what would it cost?
export function evaluatePolicy(grid,tiers=LADDER){
 let cost=0,known=true,durationMs=0;const path=[];
 for(const tier of tiers){const r=grid[tier];if(!r)return {chosenTier:null,path,cost:null,durationMs:null,complete:false};path.push(tier);if(Number.isFinite(r.cost))cost+=r.cost;else known=false;durationMs+=r.durationMs||0;if(r.status==='passed')return {chosenTier:tier,path,cost:known?cost:null,durationMs,complete:true};if(r.status==='cancelled'||HALT.has(r.error))return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true,halted:true};}
 return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true};
}
