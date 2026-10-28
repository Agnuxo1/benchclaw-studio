import {randomUUID} from 'node:crypto';
import {makeRun,executeRun} from './engine.mjs';
import {MODELS,LADDER} from './models.mjs';
// Errors that say nothing about the model's ability to do the task: escalating would only spend more.
const HALT=new Set(['cancelled','credentials_missing','authentication_failed','rate_limited','token_budget_exhausted','token_accounting_unknown','token_budget_overrun','storage_error']);
export function makeLadder(taskId,profile,allowedTools,owner,{seed=null,tiers=LADDER}={}){
 if(!Array.isArray(tiers)||!tiers.length||tiers.some(t=>!Object.hasOwn(MODELS,t))||new Set(tiers).size!==tiers.length)throw new Error('invalid_configuration');
 makeRun(taskId,profile,allowedTools,owner,MODELS[tiers[0]].id);
 return {id:randomUUID(),owner,taskId,profile,allowedTools:[...new Set(allowedTools)],tiers:[...tiers],seed:Number.isSafeInteger(seed)?seed:null,status:'queued',chosenTier:null,steps:[],cost:null,durationMs:null,createdAt:new Date().toISOString()};
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
  ladder.durationMs=Math.round(performance.now()-started);await persistLadder(ladder);
 }
 return ladder;
}
// Offline policy evaluation over a full tier grid: which tier would the ladder pick, and what would it cost?
export function evaluatePolicy(grid,tiers=LADDER){
 let cost=0,known=true,durationMs=0;const path=[];
 for(const tier of tiers){const r=grid[tier];if(!r)return {chosenTier:null,path,cost:null,durationMs:null,complete:false};path.push(tier);if(Number.isFinite(r.cost))cost+=r.cost;else known=false;durationMs+=r.durationMs||0;if(r.status==='passed')return {chosenTier:tier,path,cost:known?cost:null,durationMs,complete:true};if(r.status==='cancelled'||HALT.has(r.error))return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true,halted:true};}
 return {chosenTier:null,path,cost:known?cost:null,durationMs,complete:true};
}
