import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLadder,executeLadder,evaluatePolicy} from '../server/ladder.mjs';
import {MODELS,LADDER,callCost,runCost} from '../server/models.mjs';
import {NebiusClient} from '../server/nebius.mjs';
import {TASKS} from '../server/tasks.mjs';
const tools=TASKS.find(t=>t.id==='invoice-cleanup').tools;
// Scripted client: each model id maps to a fixed action script; usage is reported so cost can be computed.
function scripted(byModel){const seen=[];return {model:MODELS.super.id,seen,async complete(messages,{model}){seen.push(model);const script=byModel[model];const turn=messages.filter(m=>m.role==='assistant').length;return {content:JSON.stringify(script[Math.min(turn,script.length-1)]),evidence:{provider:'scripted',model,status:200,durationMs:1,usage:{prompt_tokens:1000,completion_tokens:100,total_tokens:1100},finishReason:'stop'}};}};}
const quit=[{finish:true,summary:'gave up'}];
test('Ladder stops at the first tier whose checks pass',async()=>{
 const csv=['id,amount_cents,status','A01,123450,valid','A02,1999,valid','A03,0,valid','A04,,invalid','A05,,invalid','A06,-1250,valid',''].join('\n');
 const good=[{tool:'read_file',args:{path:'invoices.csv'}},{tool:'write_file',args:{path:'normalized.csv',content:csv}},{finish:true,summary:'done'}];
 const client=scripted({[MODELS.lightning.id]:quit,[MODELS.super.id]:good,[MODELS.ultra.id]:good});
 const ladder=makeLadder('invoice-cleanup','lean',tools,'owner');const runs=[];
 await executeLadder(ladder,client,{register:r=>runs.push(r)});
 assert.equal(ladder.steps[0].tier,'lightning');assert.equal(ladder.steps[0].status,'failed');
 assert.equal(ladder.chosenTier,'super');assert.equal(ladder.status,'resolved');assert.equal(ladder.steps.length,2);assert.ok(!client.seen.includes(MODELS.ultra.id));
 assert.ok(runs.every(r=>r.ladderId===ladder.id));
});
test('Ladder reports unresolved when no tier passes and never repeats a tier',async()=>{
 const client=scripted({[MODELS.lightning.id]:quit,[MODELS.super.id]:quit,[MODELS.ultra.id]:quit});
 const ladder=await executeLadder(makeLadder('invoice-cleanup','lean',tools,'o'),client);
 assert.equal(ladder.status,'unresolved');assert.deepEqual(ladder.steps.map(s=>s.tier),LADDER);
});
test('Ladder halts on budget errors instead of escalating',async()=>{
 const client={model:MODELS.super.id,calls:0,async complete(){this.calls++;const e=new Error('token_budget_exhausted');e.code='token_budget_exhausted';throw e;}};
 const ladder=await executeLadder(makeLadder('invoice-cleanup','lean',tools,'o'),client);
 assert.equal(ladder.status,'halted');assert.equal(ladder.steps.length,1);assert.equal(client.calls,1);
});
test('Invalid ladder tiers are rejected',()=>{assert.throws(()=>makeLadder('invoice-cleanup','lean',tools,'o',{tiers:['ultra','ultra']}));assert.throws(()=>makeLadder('invoice-cleanup','lean',tools,'o',{tiers:['gpt']}));});
test('Cost is unknown unless every call has a verified price and usage',()=>{
 assert.equal(callCost(MODELS.ultra.id,{prompt_tokens:1e6,completion_tokens:1e6}),4);
 assert.equal(callCost(MODELS.ultra.id,{prompt_tokens:null,completion_tokens:5}),null);
 assert.equal(callCost('nvidia/unknown',{prompt_tokens:1,completion_tokens:1}),null);
 assert.equal(runCost([]),null);
});
test('Offline policy evaluation picks the first passing tier and sums the path',()=>{
 const grid={lightning:{status:'failed',cost:0.001,durationMs:10},super:{status:'passed',cost:0.002,durationMs:20},ultra:{status:'passed',cost:0.01,durationMs:30}};
 const p=evaluatePolicy(grid);assert.equal(p.chosenTier,'super');assert.deepEqual(p.path,['lightning','super']);assert.ok(Math.abs(p.cost-0.003)<1e-12);assert.equal(p.durationMs,30);
});
test('Per-call model override is limited to published Nemotron tiers',async()=>{
 let body;const client=new NebiusClient(async()=>'synthetic-test-key',MODELS.super.id,async(url,b)=>{body=b;return {choices:[{message:{content:'{"finish":true}'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};});
 await client.complete([],{model:MODELS.ultra.id,seed:22});assert.equal(body.model,MODELS.ultra.id);assert.equal(body.seed,22);
 await assert.rejects(()=>client.complete([],{model:'meta/llama'}),e=>e.code==='model_not_allowed');
});
