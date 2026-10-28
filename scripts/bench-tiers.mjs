// Tier benchmark: every task × profile × seed on each Nemotron tier through the real Nebius Token Factory API.
// No stubs: without NEBIUS_API_KEY the script stops before any run.
// Usage: node scripts/bench-tiers.mjs --out experiments/E01 --tiers lightning,super,ultra --seeds 11,22,33 --token-cap 3000000
import http from 'node:http';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
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
import {summarize,mergeRuns,isNotExecuted} from './summarize.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const out=arg('out','experiments/E01'),tiers=arg('tiers',LADDER.join(',')).split(','),seeds=arg('seeds','11,22,33').split(',').map(Number);
const profiles=arg('profiles',Object.keys(PROFILES).join(',')).split(','),tasks=arg('tasks',TASKS.map(t=>t.id).join(',')).split(',');
const cap=Number(arg('token-cap','3000000')),concurrency=Number(arg('concurrency','3')),hypothesis=arg('hypothesis','H1'),maxTokens=Number(arg('max-tokens','8192'));
if(tiers.some(t=>!MODELS[t])||seeds.some(s=>!Number.isSafeInteger(s)))throw new Error('Invalid tiers or seeds');
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
const csv=join(out,'results.csv');
if(!existsSync(csv))await writeFile(csv,'id,date,hypothesis,tier,model,task,profile,seed,status,checks,durationMs,tokens,cost_usd,calls,error,commit\n');
// --complete <runs dir>: only the cells whose recorded run was stopped by the token ledger before reaching the model.
const complete=arg('complete',null),pending=complete?new Set(mergeRuns([complete]).filter(isNotExecuted).map(r=>[r.tier,r.taskId,r.profile,r.inference.seed].join('|'))):null;
const jobs=[];for(const seed of seeds)for(const task of tasks)for(const profile of profiles)for(const tier of tiers)if(!pending||pending.has([tier,task,profile,seed].join('|')))jobs.push({seed,task,profile,tier});
console.log(`${jobs.length} runs`);
const results=[];let next=0;
async function worker(){
 while(next<jobs.length){
  const {seed,task,profile,tier}=jobs[next++];
  const run=makeRun(task,profile,TASKS.find(t=>t.id===task).tools,'bench',MODELS[tier].id,{seed,maxTokens});
  await executeRun(run,client,{health:()=>broker.execute('synthetic_health')});
  const s=JSON.stringify(run).split(key).join('[REDACTED]');await writeFile(join(out,'runs',run.id+'.json'),s);
  results.push(JSON.parse(s));
  const checks=run.result?`${run.result.passedCount}/${run.result.total}`:'';
  await appendFile(csv,[run.id,run.createdAt,hypothesis,tier,run.model,task,profile,seed,run.status,checks,run.durationMs,run.tokens??'',run.cost??'',run.calls.length,run.error??'',commit].join(',')+'\n');
  console.log(`${tier.padEnd(9)} ${task.padEnd(16)} ${profile.padEnd(8)} seed=${seed} ${run.status.padEnd(9)} ${checks.padEnd(5)} ${(run.durationMs/1000).toFixed(1)}s tok=${run.tokens??'?'} ${run.error??''}`);
 }
}
await Promise.all(Array.from({length:concurrency},worker));
service.close();
const summary=summarize(results,{tiers,seeds,profiles,tasks,commit,maxTokens,tokenLedger:budget.snapshot(),completes:complete});
await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({byTier:summary.byTier,policies:summary.policies},null,1));
