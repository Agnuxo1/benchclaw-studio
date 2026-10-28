import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLadder,executeSpeculativeLadder,evaluateSpeculative,evaluatePolicy} from '../server/ladder.mjs';
import {MODELS,LADDER} from '../server/models.mjs';
import {TASKS} from '../server/tasks.mjs';
import {summarize} from '../scripts/summarize.mjs';
const tools=TASKS.find(t=>t.id==='invoice-cleanup').tools;
const csv=['id,amount_cents,status','A01,123450,valid','A02,1999,valid','A03,0,valid','A04,,invalid','A05,,invalid','A06,-1250,valid',''].join('\n');
const good=[{tool:'read_file',args:{path:'invoices.csv'}},{tool:'write_file',args:{path:'normalized.csv',content:csv}},{finish:true,summary:'done'}];
const quit=[{finish:true,summary:'gave up'}];
// Scripted client with a fixed delay per model, so the order in which parallel runs finish is controlled.
function timed(byModel,delay){const seen=[];return {model:MODELS.super.id,seen,async complete(messages,{model,signal}){seen.push(model);await new Promise((r,j)=>{const t=setTimeout(r,delay[model]||1);signal?.addEventListener('abort',()=>{clearTimeout(t);j(new Error('cancelled'));},{once:true});});const script=byModel[model];const turn=messages.filter(m=>m.role==='assistant').length;return {content:JSON.stringify(script[Math.min(turn,script.length-1)]),evidence:{provider:'scripted',model,status:200,durationMs:1,usage:{prompt_tokens:1000,completion_tokens:100,total_tokens:1100},finishReason:'stop'}};}};}
const L=MODELS.lightning.id,S=MODELS.super.id,U=MODELS.ultra.id;
test('Speculative ladder answers with the first passing run and still settles the slower one',async()=>{
 const client=timed({[L]:good,[S]:good,[U]:good},{[L]:40,[S]:2});const decisions=[];
 const ladder=makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'});
 await executeSpeculativeLadder(ladder,client,{persistLadder:async l=>{if(l.decisionMs!==null)decisions.push(l.chosenTier);}});
 assert.equal(ladder.chosenTier,'super');assert.equal(ladder.status,'resolved');assert.equal(decisions[0],'super');
 assert.ok(ladder.decisionMs<ladder.durationMs);assert.deepEqual(ladder.steps.map(s=>[s.tier,s.status]),[['lightning','passed'],['super','passed']]);
 assert.ok(!client.seen.includes(U));assert.ok(Number.isFinite(ladder.cost));
});
test('Speculative ladder keeps Lightning when it passes first',async()=>{
 const ladder=await executeSpeculativeLadder(makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'}),timed({[L]:good,[S]:good,[U]:good},{[L]:1,[S]:30}));
 assert.equal(ladder.chosenTier,'lightning');
});
test('Speculative ladder waits for a slower pass when the faster run fails',async()=>{
 const ladder=await executeSpeculativeLadder(makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'}),timed({[L]:good,[S]:quit,[U]:good},{[L]:30,[S]:1}));
 assert.equal(ladder.chosenTier,'lightning');assert.equal(ladder.steps.length,2);
});
test('Speculative ladder runs Ultra only after both parallel tiers fail',async()=>{
 const client=timed({[L]:quit,[S]:quit,[U]:good},{});
 const ladder=await executeSpeculativeLadder(makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'}),client);
 assert.equal(ladder.chosenTier,'ultra');assert.deepEqual(ladder.steps.map(s=>s.tier),['lightning','super','ultra']);assert.ok(ladder.durationMs-ladder.decisionMs<=5);
 const none=await executeSpeculativeLadder(makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'}),timed({[L]:quit,[S]:quit,[U]:quit},{}));
 assert.equal(none.status,'unresolved');assert.equal(none.chosenTier,null);
});
test('Speculative ladder halts on ledger errors and honours cancellation',async()=>{
 const blocked={model:S,calls:0,async complete(){this.calls++;const e=new Error('token_accounting_unknown');e.code='token_accounting_unknown';throw e;}};
 const halted=await executeSpeculativeLadder(makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'}),blocked);
 assert.equal(halted.status,'halted');assert.equal(blocked.calls,2);assert.equal(halted.steps.length,2);
 const controller=new AbortController();const p=executeSpeculativeLadder(makeLadder('invoice-cleanup','lean',tools,'o',{policy:'speculative'}),timed({[L]:good,[S]:good,[U]:good},{[L]:200,[S]:200}),{signal:controller.signal});
 setTimeout(()=>controller.abort(),10);const cancelled=await p;assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.steps.length,2);
});
test('Unknown ladder policies are rejected',()=>{assert.throws(()=>makeLadder('invoice-cleanup','lean',tools,'o',{policy:'random'}));});
test('Offline speculative evaluation: earliest passing parallel run, else slower parallel run plus the rest',()=>{
 const r=(status,cost,durationMs)=>({status,cost,durationMs});
 let p=evaluateSpeculative({lightning:r('passed',0.001,50),super:r('passed',0.003,20),ultra:r('passed',0.01,5)});
 assert.equal(p.chosenTier,'super');assert.equal(p.durationMs,20);assert.ok(Math.abs(p.cost-0.004)<1e-12);assert.deepEqual(p.path,['lightning','super']);
 p=evaluateSpeculative({lightning:r('passed',0.001,20),super:r('passed',0.003,20),ultra:r('passed',0.01,5)});assert.equal(p.chosenTier,'lightning');
 p=evaluateSpeculative({lightning:r('failed',0.001,50),super:r('failed',0.003,20),ultra:r('passed',0.01,5)});
 assert.equal(p.chosenTier,'ultra');assert.equal(p.durationMs,55);assert.ok(Math.abs(p.cost-0.014)<1e-12);
 p=evaluateSpeculative({lightning:r('failed',null,50),super:r('passed',0.003,20),ultra:r('passed',0.01,5)});assert.equal(p.cost,null);assert.equal(p.chosenTier,'super');
 assert.equal(evaluateSpeculative({lightning:r('failed',0,1)}).complete,false);
});
test('Summary adds speculative and tier-memory policies without changing the existing ones',()=>{
 const run=(tier,taskId,seed,status,cost,durationMs)=>({tier,taskId,profile:'lean',inference:{seed},status,cost,durationMs,tokens:1,error:null});
 const results=[];for(const seed of [11,22])for(const [tier,st,c,d] of [['lightning','failed',0.001,30],['super',seed===11?'passed':'failed',0.003,10],['ultra','passed',0.01,5]])results.push(run(tier,'invoice-cleanup',seed,st,c,d));
 const s=summarize(results,{tiers:LADDER,seeds:[11,22],profiles:['lean'],tasks:['invoice-cleanup']});
 assert.equal(s.policies.ladder.durationMs,(40+45)/2);assert.equal(s.policies.speculative.durationMs,(10+35)/2);
 // Seed 11 resolves on Super, so seed 22 starts there and skips Lightning.
 assert.equal(s.cells[1].memory.startTier,'super');assert.equal(s.policies.tier_memory.durationMs,(40+15)/2);
 assert.ok(Math.abs(s.policies.tier_memory.costUSD-(0.004+0.013)/2)<1e-12);
 assert.equal(evaluatePolicy({lightning:run('lightning','x',1,'passed',1,1)}).chosenTier,'lightning');
});
test('A provider call may use the run remaining time instead of a fixed 45 s',async()=>{
 const {makeRun,executeRun}=await import('../server/engine.mjs');const {NebiusClient}=await import('../server/nebius.mjs');
 const seen=[];const client=new NebiusClient(async()=>'synthetic-test-key',MODELS.super.id,async(url,b,o)=>{seen.push(o.timeoutMs);return {choices:[{message:{content:'{"finish":true}'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};});
 const run=makeRun('invoice-cleanup','lean',tools,'o',MODELS.lightning.id);await executeRun(run,client);
 assert.equal(seen.length,1);assert.ok(seen[0]>171000&&seen[0]<=181000,String(seen[0]));
 const legacy=[];await new NebiusClient(async()=>'k',MODELS.super.id,async(u,b,o)=>{legacy.push(o.timeoutMs);return {choices:[{message:{content:'{}'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};}).complete([]);
 assert.deepEqual(legacy,[undefined]);
});
