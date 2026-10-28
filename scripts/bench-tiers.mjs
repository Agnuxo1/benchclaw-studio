// Tier benchmark: every task × profile × seed on each Nemotron tier through the real Nebius Token Factory API.
// No stubs: without NEBIUS_API_KEY the script stops before any run.
// Usage: node scripts/bench-tiers.mjs --out experiments/E01 --tiers lightning,super,ultra --seeds 11,22,33 --token-cap 3000000
// Live policy mode (E03): --policy speculative runs one speculative ladder per task × profile × seed, one cell at a time.
import http from 'node:http';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {existsSync,readFileSync,writeFileSync,renameSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {VaultManager,MemoryStorage} from '../vendor/enigmagent/vault-core.js';
import {OperationBroker} from '../vendor/enigmagent/operation-broker.js';
import {NebiusClient} from '../server/nebius.mjs';
import {TokenBudget} from '../server/token-budget.mjs';
import {TASKS} from '../server/tasks.mjs';
import {makeRun,executeRun,PROFILES} from '../server/engine.mjs';
import {MODELS,LADDER} from '../server/models.mjs';
import {summarize,mergeRuns,NOT_EXECUTED,summarizeLadders} from './summarize.mjs';
import {makeLadder,executeSpeculativeLadder} from '../server/ladder.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const out=arg('out','experiments/E01'),tiers=arg('tiers',LADDER.join(',')).split(','),seeds=arg('seeds','11,22,33').split(',').map(Number);
const profiles=arg('profiles',Object.keys(PROFILES).join(',')).split(','),tasks=arg('tasks',TASKS.map(t=>t.id).join(',')).split(',');
const cap=Number(arg('token-cap','3000000')),concurrency=Number(arg('concurrency','3')),hypothesis=arg('hypothesis','H1'),maxTokens=Number(arg('max-tokens','8192'));
if(tiers.some(t=>!MODELS[t])||seeds.some(s=>!Number.isSafeInteger(s)))throw new Error('Invalid tiers or seeds');
// --usd-cap: monetary stop from provider-reported usage × published prices. A job (or a live cell of up to 3 runs) starts only if
// the spend so far plus a worst-case reserve per run still fits; a run with unknown cost counts as the reserve.
const usdCap=Number(arg('usd-cap','Infinity')),RUN_RESERVE_USD=0.035;let spentUSD=0,inflightRuns=0,capStops=0;
const admit=n=>{if(spentUSD+(inflightRuns+n)*RUN_RESERVE_USD<=usdCap){inflightRuns+=n;return true;}capStops++;return false;};
const charge=(n,costs)=>{inflightRuns-=n;for(const c of costs)spentUSD+=Number.isFinite(c)?c:RUN_RESERVE_USD;};
const key=process.env.NEBIUS_API_KEY;delete process.env.NEBIUS_API_KEY;
if(!key)throw new Error('NEBIUS_API_KEY is required; this benchmark never substitutes simulated runs.');
await mkdir(join(out,'runs'),{recursive:true});
let commit='uncommitted';try{commit=execFileSync('git',['rev-parse','--short','HEAD'],{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{}
// Same EnigmAgent vault and fixed-operation broker as the Studio server.
const vault=new VaultManager(new MemoryStorage());await vault.create('bench',randomBytes(32).toString('hex'));
await vault.addSecret({name:'nebius_api',domain:'api.tokenfactory.nebius.com',value:key});
const protectedSecret=randomBytes(32).toString('hex');await vault.addSecret({name:'synthetic_service',domain:'127.0.0.1',value:protectedSecret});
const service=http.createServer((req,res)=>{res.writeHead(req.url==='/health'&&req.headers.authorization===`Bearer ${protectedSecret}`?200:401);res.end();});
await new Promise(r=>service.listen(0,'127.0.0.1',r));
const broker=new OperationBroker({vault,allowLoopback:true,operations:[{name:'synthetic_health',url:`http://127.0.0.1:${service.address().port}/health`,secret:'synthetic_service'}]});
const ledgerFile=join(out,'token-ledger.json');
const budget=new TokenBudget(cap,existsSync(ledgerFile)?JSON.parse(readFileSync(ledgerFile,'utf8')):undefined,s=>{writeFileSync(ledgerFile+'.tmp',JSON.stringify(s));renameSync(ledgerFile+'.tmp',ledgerFile);});
const client=new NebiusClient(()=>vault.resolve('nebius_api','https://api.tokenfactory.nebius.com'),MODELS.super.id,undefined,budget);
const policy=arg('policy',null);
if(policy){
 if(policy!=='speculative')throw new Error('Only --policy speculative is supported');
 await mkdir(join(out,'ladders'),{recursive:true});
 const lcsv=join(out,'ladders.csv');if(!existsSync(lcsv))await writeFile(lcsv,'id,date,hypothesis,policy,task,profile,seed,status,chosenTier,decisionMs,durationMs,cost_usd,steps,commit\n');
 const save=async r=>writeFile(join(out,'runs',r.id+'.json'),JSON.stringify(r).split(key).join('[REDACTED]'));
 // --complete <dir>: cells whose ladder halted on the ledger. Steps that already reached the model are kept; the missing parallel steps,
 // and Ultra if neither parallel step passes, run again individually. The cell is then composed with the offline rule (evaluateSpeculative).
 const prior=arg('complete',null),cells=[];
 for(const seed of seeds)for(const task of tasks)for(const profile of profiles)cells.push({seed,task,profile});
 const priorAll=prior?readdirSync(join(prior,'ladders')).map(f=>JSON.parse(readFileSync(join(prior,'ladders',f),'utf8'))):[],priorLadders=priorAll.filter(l=>l.status==='halted');
 const priorRuns=prior?new Map(mergeRuns([join(prior,'runs')]).map(r=>[r.id,r])):null;
 // The summary covers every cell: prior ladders that did not halt plus the composed ones.
 const done=priorAll.filter(l=>l.status!=='halted');
 for(const c of prior?priorLadders.map(l=>({seed:l.seed,task:l.taskId,profile:l.profile,ladder:l})):cells){
  const allowed=TASKS.find(t=>t.id===c.task).tools;
  if(!admit(3)){console.log(`USD cap reached: ${c.task} ${c.profile} seed=${c.seed} not started`);continue;}
  if(!c.ladder){
   const ladder=makeLadder(c.task,c.profile,allowed,'bench',{seed:c.seed,policy});const runs=[];
   await executeSpeculativeLadder(ladder,client,{register:r=>runs.push(r),persistLadder:async l=>writeFile(join(out,'ladders',l.id+'.json'),JSON.stringify(l,null,2)),health:()=>broker.execute('synthetic_health')});
   for(const r of runs)await save(r);done.push(ladder);charge(3,runs.map(r=>r.cost));
   await appendFile(lcsv,[ladder.id,ladder.createdAt,hypothesis,policy,c.task,c.profile,c.seed,ladder.status,ladder.chosenTier??'',ladder.decisionMs,ladder.durationMs,ladder.cost??'',ladder.steps.map(st=>`${st.tier}:${st.status}:${st.error??''}:${st.durationMs}`).join(' '),commit].join(',')+'\n');
   console.log(`${c.task.padEnd(16)} ${c.profile.padEnd(8)} seed=${c.seed} ${ladder.status.padEnd(10)} ${String(ladder.chosenTier).padEnd(9)} answer=${(ladder.decisionMs/1000).toFixed(1)}s settled=${(ladder.durationMs/1000).toFixed(1)}s ${ladder.steps.map(st=>st.tier[0]+':'+(st.error||st.status)).join(' ')}`);
  }else{
   const grid={};for(const st of c.ladder.steps){const r=priorRuns.get(st.runId);if(r&&!NOT_EXECUTED.has(r.error)&&r.status!=='cancelled')grid[st.tier]=r;}
   const rerun=async tier=>{const r=makeRun(c.task,c.profile,allowed,'bench',MODELS[tier].id,{seed:c.seed,maxTokens});await executeRun(r,client,{health:()=>broker.execute('synthetic_health')});await save(r);grid[tier]=r;};
   await Promise.all(LADDER.slice(0,2).filter(t=>!grid[t]).map(rerun));
   if(!LADDER.slice(0,2).some(t=>grid[t].status==='passed')&&!grid.ultra)await rerun('ultra');
   const composed={...c.ladder,id:c.ladder.id,composedFrom:prior,steps:LADDER.filter(t=>grid[t]).map(t=>({tier:t,runId:grid[t].id,status:grid[t].status,error:grid[t].error,cost:grid[t].cost,tokens:grid[t].tokens,durationMs:grid[t].durationMs}))};
   await writeFile(join(out,'ladders',composed.id+'.json'),JSON.stringify(composed,null,2));done.push(composed);charge(3,composed.steps.filter(st=>!c.ladder.steps.some(o=>o.runId===st.runId)).map(st=>st.cost));
   console.log(`${c.task.padEnd(16)} ${c.profile.padEnd(8)} seed=${c.seed} composed  ${composed.steps.map(st=>st.tier[0]+':'+(st.error||st.status)).join(' ')}`);
  }
 }
 service.close();
 const summary={spentUSD,usdCap:Number.isFinite(usdCap)?usdCap:null,capStops,...summarizeLadders(done,new Map(mergeRuns([join(out,'runs'),...(prior?[join(prior,'runs')]:[])]).map(r=>[r.id,r]))),policy,commit,maxTokens,seeds,tasks,profiles,tokenLedger:budget.snapshot(),completes:prior};
 await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary.aggregate,null,1));process.exit(0);
}
const csv=join(out,'results.csv');
if(!existsSync(csv))await writeFile(csv,'id,date,hypothesis,tier,model,task,profile,seed,status,checks,durationMs,tokens,cost_usd,calls,error,commit\n');
// --complete <runs dir>: only the cells whose recorded run was stopped by the token ledger before reaching the model.
const complete=arg('complete',null),pending=complete?new Set(mergeRuns([complete]).filter(r=>NOT_EXECUTED.has(r.error)).map(r=>[r.tier,r.taskId,r.profile,r.inference.seed].join('|'))):null;
const jobs=[];for(const seed of seeds)for(const task of tasks)for(const profile of profiles)for(const tier of tiers)if(!pending||pending.has([tier,task,profile,seed].join('|')))jobs.push({seed,task,profile,tier});
console.log(`${jobs.length} runs`);
const results=[];let next=0;
async function worker(){
 while(next<jobs.length){
  // Without room for one more run: this worker retires while others are in flight, and the whole grid stops when none is.
  if(!admit(1)){if(inflightRuns>0)return;next=jobs.length;break;}
  const {seed,task,profile,tier}=jobs[next++];
  const run=makeRun(task,profile,TASKS.find(t=>t.id===task).tools,'bench',MODELS[tier].id,{seed,maxTokens});
  await executeRun(run,client,{health:()=>broker.execute('synthetic_health')});
  const s=JSON.stringify(run).split(key).join('[REDACTED]');await writeFile(join(out,'runs',run.id+'.json'),s);
  results.push(JSON.parse(s));charge(1,[run.cost]);
  const checks=run.result?`${run.result.passedCount}/${run.result.total}`:'';
  await appendFile(csv,[run.id,run.createdAt,hypothesis,tier,run.model,task,profile,seed,run.status,checks,run.durationMs,run.tokens??'',run.cost??'',run.calls.length,run.error??'',commit].join(',')+'\n');
  console.log(`${tier.padEnd(9)} ${task.padEnd(16)} ${profile.padEnd(8)} seed=${seed} ${run.status.padEnd(9)} ${checks.padEnd(5)} ${(run.durationMs/1000).toFixed(1)}s tok=${run.tokens??'?'} ${run.error??''}`);
 }
}
await Promise.all(Array.from({length:concurrency},worker));
service.close();
const summary=summarize(results,{tiers,seeds,profiles,tasks,commit,maxTokens,tokenLedger:budget.snapshot(),completes:complete,spentUSD,usdCap:Number.isFinite(usdCap)?usdCap:null,notStarted:jobs.length-results.length});
await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({byTier:summary.byTier,policies:summary.policies},null,1));
