import http from 'node:http';
import {readFile,mkdir,writeFile,rename,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {TokenBudget} from './token-budget.mjs';
import {VaultManager,MemoryStorage} from '../vendor/enigmagent/vault-core.js';
import {OperationBroker} from '../vendor/enigmagent/operation-broker.js';
import {NebiusClient} from './nebius.mjs';
import {TASKS} from './tasks.mjs';
import {makeRun,executeRun,compare,PROFILES,TOOL_LABELS} from './engine.mjs';
import {MODELS,LADDER} from './models.mjs';
import {makeLadder,executeLadder} from './ladder.mjs';
try{process.loadEnvFile('.env');}catch{}
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const DATA=resolve(process.env.STUDIO_DATA||join(ROOT,'data'));await mkdir(join(DATA,'ladders'),{recursive:true});
// Public mode: one HTTPS origin behind a proxy. Loopback stays the default.
const PUBLIC_ORIGIN=process.env.STUDIO_PUBLIC_ORIGIN?new URL(process.env.STUDIO_PUBLIC_ORIGIN).origin:null;
const HOSTS=new Set(['127.0.0.1','localhost',...(PUBLIC_ORIGIN?[new URL(PUBLIC_ORIGIN).hostname]:[])]);
const perOwner=Number(process.env.STUDIO_MAX_RUNS_PER_OWNER||0);
const vault=new VaultManager(new MemoryStorage());await vault.create('studio-backend',randomBytes(32).toString('hex'));
const suppliedKey=process.env.NEBIUS_API_KEY;
if(suppliedKey)await vault.addSecret({name:'nebius_api',domain:'api.tokenfactory.nebius.com',value:suppliedKey});
delete process.env.NEBIUS_API_KEY;
const protectedSecret=randomBytes(32).toString('hex');
await vault.addSecret({name:'synthetic_service',domain:'127.0.0.1',value:protectedSecret});
const service=http.createServer((req,res)=>{res.writeHead(req.url==='/health'&&req.headers.authorization===`Bearer ${protectedSecret}`?200:401,{'Content-Type':'text/plain'});res.end('Synthetic service fixture; response body is discarded by EnigmAgent.');});
await new Promise(r=>service.listen(0,'127.0.0.1',r));
const broker=new OperationBroker({vault,allowLoopback:true,operations:[{name:'synthetic_health',url:`http://127.0.0.1:${service.address().port}/health`,secret:'synthetic_service'}]});
const ledgerFile=join(DATA,'token-ledger.json');
const ledger=existsSync(ledgerFile)?JSON.parse(readFileSync(ledgerFile,'utf8')):undefined;
const budget=new TokenBudget(Number(process.env.STUDIO_MAX_TOTAL_TOKENS||0),ledger,state=>{writeFileSync(ledgerFile+'.tmp',JSON.stringify(state),{mode:0o600});renameSync(ledgerFile+'.tmp',ledgerFile);});
const client=new NebiusClient(async()=>suppliedKey?await vault.resolve('nebius_api','https://api.tokenfactory.nebius.com'):null,undefined,undefined,budget);
const enabled=process.env.STUDIO_INFERENCE_ENABLED==='1'&&!!suppliedKey&&budget.limit>0;
const runs=new Map(),ladders=new Map(),controllers=new Map();let inflight=0;const inflightOwners=new Set();
for(const f of await readdir(join(DATA,'ladders')))if(/^[a-f0-9-]{36}\.json$/.test(f)){try{const l=JSON.parse(await readFile(join(DATA,'ladders',f),'utf8'));if(['running','queued'].includes(l.status))l.status='halted';ladders.set(l.id,l);}catch{}}
const SHOWCASE=join(ROOT,'showcase');let showcase={index:null,runs:new Map()};
try{showcase.index=JSON.parse(await readFile(join(SHOWCASE,'index.json'),'utf8'));for(const f of await readdir(join(SHOWCASE,'runs')))if(/^[a-f0-9-]{36}\.json$/.test(f)){const r=JSON.parse(await readFile(join(SHOWCASE,'runs',f),'utf8'));showcase.runs.set(r.id,r);}}catch{}
for(const f of await readdir(DATA))if(/^[a-f0-9-]{36}\.json$/.test(f)){
 try{const r=JSON.parse(await readFile(join(DATA,f),'utf8'));if(['running','queued'].includes(r.status)){r.status='error';r.error='server_restarted';}runs.set(r.id,r);}catch{}
}
function sanitize(value){
 let s=JSON.stringify(value);for(const secret of [suppliedKey,protectedSecret].filter(Boolean))s=s.split(secret).join('[REDACTED]');
 return JSON.parse(s.replace(/Bearer [A-Za-z0-9._~-]{16,}/g,'Bearer [REDACTED]'));
}
async function persistLadder(l){const file=join(DATA,'ladders',l.id+'.json');await writeFile(file+'.tmp',JSON.stringify(l,null,2),{mode:0o600});await rename(file+'.tmp',file);}
function publicLadder(l){const {owner,...rest}=l;return rest;}
async function persist(run){const clean=sanitize(run);const file=join(DATA,run.id+'.json');await writeFile(file+'.tmp',JSON.stringify(clean,null,2),{mode:0o600});await rename(file+'.tmp',file);}
function publicRun(run){const {owner,...rest}=sanitize(run);return rest;}
const tokenHash=s=>createHash('sha256').update(s).digest('hex');
const maxRuns=Number(process.env.STUDIO_MAX_RUNS||30);
if(!Number.isInteger(maxRuns)||maxRuns<1||maxRuns>500)throw new Error('Invalid run cap');
const STATIC={'/':['index.html','text/html'],'/style.css':['style.css','text/css'],'/app.js':['app.js','text/javascript']};
const server=http.createServer(async(req,res)=>{
 const send=(code,value,headers={})=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));};
 try{
  if(!req.headers.host||!HOSTS.has(req.headers.host.split(':')[0]))return send(403,{error:'host_not_allowed'});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='GET'&&STATIC[url.pathname]){const [f,type]=STATIC[url.pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(await readFile(join(ROOT,'public',f)));return;}
  if(!url.pathname.startsWith('/api/'))return send(404,{error:'not_found'});
  let token=req.headers.cookie?.match(/(?:^|;\s*)studio=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token){token=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`studio=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`);}
  const owner=tokenHash(token);
  if(req.method==='POST'&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==PUBLIC_ORIGIN)return send(403,{error:'origin_not_allowed'});
  if(req.method==='GET'&&url.pathname==='/api/catalog')return send(200,{tasks:TASKS,profiles:PROFILES,toolLabels:TOOL_LABELS,models:MODELS,ladder:LADDER,publicMode:!!PUBLIC_ORIGIN,showcase:showcase.index?{runs:showcase.runs.size,generatedAt:showcase.index.generatedAt}:null,provider:{name:'Nebius Token Factory',model:client.model,configured:!!suppliedKey,enabled:enabled&&!budget.snapshot().blocked,creditBalance:null},limits:{maxRuns,usedRuns:runs.size,perOwner:perOwner||null,steps:12,timeoutSeconds:180,tokenBudget:budget.snapshot()},enigmagent:{version:'3.0.0',vaultFormat:2,health:'real synthetic local service; no external credentials'}});
  if(req.method==='GET'&&url.pathname==='/api/runs')return send(200,[...runs.values()].filter(r=>r.owner===owner).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicRun));
  if(req.method==='GET'&&url.pathname==='/api/ladders')return send(200,[...ladders.values()].filter(l=>l.owner===owner).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicLadder));
  if(req.method==='GET'&&url.pathname==='/api/showcase')return send(200,showcase.index?{...showcase.index,runs:[...showcase.runs.values()]}:{error:'no_showcase'});
  if(req.method==='GET'&&url.pathname==='/api/compare'){
   const pick=id=>{const r=runs.get(id);return r&&r.owner===owner?r:showcase.runs.get(id);};const a=pick(url.searchParams.get('a')),b=pick(url.searchParams.get('b'));if(!a||!b)return send(404,{error:'not_found'});
   return send(200,compare(publicRun(a),publicRun(b)));
  }
  const lmatch=url.pathname.match(/^\/api\/ladders\/([a-f0-9-]{36})\/cancel$/);
  if(lmatch&&req.method==='POST'){const l=ladders.get(lmatch[1]);if(!l||l.owner!==owner)return send(404,{error:'not_found'});controllers.get(l.id)?.abort();return send(200,{status:'cancellation_requested'});}
  const match=url.pathname.match(/^\/api\/runs\/([a-f0-9-]{36})(?:\/(cancel|report))?$/);
  if(match&&req.method==='GET'&&!runs.has(match[1])&&showcase.runs.has(match[1])){const report=showcase.runs.get(match[1]);if(match[2]==='report')return send(200,{format:'benchclaw-evidence-v1',exportedAt:new Date().toISOString(),report,sha256:createHash('sha256').update(JSON.stringify(report)).digest('hex')},{'Content-Disposition':`attachment; filename="benchclaw-${report.id}.json"`});if(!match[2])return send(200,report);}
  if(match){const run=runs.get(match[1]);if(!run||run.owner!==owner)return send(404,{error:'not_found'});
   if(req.method==='GET'&&match[2]==='report'){
    const report=publicRun(run);return send(200,{format:'benchclaw-evidence-v1',exportedAt:new Date().toISOString(),report,sha256:createHash('sha256').update(JSON.stringify(report)).digest('hex')},{'Content-Disposition':`attachment; filename="benchclaw-${run.id}.json"`});
   }
   if(req.method==='GET'&&!match[2])return send(200,publicRun(run));
   if(req.method==='POST'&&match[2]==='cancel'){controllers.get(run.id)?.abort();if(run.ladderId)controllers.get(run.ladderId)?.abort();return send(200,{status:'cancellation_requested'});}
  }
  if(req.method==='POST'&&(url.pathname==='/api/runs'||url.pathname==='/api/ladders')){
   const isLadder=url.pathname==='/api/ladders';
   if(!enabled)return send(503,{error:suppliedKey?'inference_disabled':'credentials_missing',message:'An operator must configure Nebius and confirm free credits. No mock run is substituted.'});
   if(budget.snapshot().blocked)return send(503,{error:'token_accounting_unknown'});
   const cost=isLadder?LADDER.length:1;
   if(runs.size+inflight+cost>maxRuns)return send(429,{error:'run_budget_exhausted'});
   if(perOwner&&[...runs.values()].filter(r=>r.owner===owner).length+cost>perOwner)return send(429,{error:'session_budget_exhausted'});
   if(controllers.size+inflight>=2||inflightOwners.has(owner)||[...runs.values()].some(r=>r.owner===owner&&['running','queued'].includes(r.status))||[...ladders.values()].some(l=>l.owner===owner&&['running','queued'].includes(l.status)))return send(429,{error:'run_already_active'});
   // Reserve the slot synchronously: the checks above must also count requests whose body is still being read.
   inflight++;inflightOwners.add(owner);let reserved=true;const release=()=>{if(reserved){reserved=false;inflight--;inflightOwners.delete(owner);}};
   let body,run,controller;
   try{
    let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>4096)return send(413,{error:'request_too_large'});chunks.push(c);}
    try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     if(isLadder)run=makeLadder(body.taskId,body.profile,body.allowedTools,owner);
     else{if(body.tier!==undefined&&!Object.hasOwn(MODELS,body.tier))throw new Error('invalid_tier');run=makeRun(body.taskId,body.profile,body.allowedTools,owner,body.tier?MODELS[body.tier].id:client.model);}
    }catch{return send(400,{error:'invalid_configuration'});}
    (isLadder?ladders:runs).set(run.id,run);controller=new AbortController();controllers.set(run.id,controller);
   }finally{release();}
   const health=()=>broker.execute('synthetic_health');
   if(isLadder){await persistLadder(run);send(202,publicLadder(run));executeLadder(run,client,{signal:controller.signal,register:r=>runs.set(r.id,r),persist,persistLadder,health}).catch(()=>{run.status='halted';}).finally(()=>controllers.delete(run.id));return;}
   await persist(run);send(202,publicRun(run));
   executeRun(run,client,{signal:controller.signal,persist,health}).catch(()=>{run.status='error';run.error='storage_error';}).finally(()=>controllers.delete(run.id));return;
  }
  send(405,{error:'method_not_allowed'});
 }catch{if(!res.headersSent)send(500,{error:'server_error'});else res.end();}
});
server.requestTimeout=10000;server.headersTimeout=10000;
const port=Number(process.env.PORT||4328);server.listen(port,process.env.STUDIO_BIND||'127.0.0.1',()=>console.log(`BenchClaw Studio ${PUBLIC_ORIGIN||`http://127.0.0.1:${port}`} · NVIDIA: ${client.model} · inference ${enabled?'enabled':'disabled'}`));
async function shutdown(){for(const c of controllers.values())c.abort();server.close();service.close();setTimeout(()=>process.exit(0),1000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
