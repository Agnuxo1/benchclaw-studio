import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRun,executeRun,compare,toolAction} from '../server/engine.mjs';
import {TASKS,validate} from '../server/tasks.mjs';
const model='nvidia/nemotron-3-super-120b-a12b';
const run=(id='invoice-cleanup')=>makeRun(id,'careful',TASKS.find(t=>t.id===id).tools,'regression-owner',model);
const scripted=actions=>{let i=0;return {model,complete:async()=>({content:JSON.stringify(actions[Math.min(i++,actions.length-1)]),evidence:{provider:'scripted-test-only',status:200,usage:null}})};};
test('Provider errors have no task score and cannot compare task outcomes',async()=>{
 const a=run(),b=run();await executeRun(a,{model,complete:async()=>{throw new Error('authentication_failed');}});
 b.status='passed';assert.equal(a.result,null);assert.equal(compare(a,b).comparable,false);
 b.model='nvidia/different';assert.equal(compare(a,b).equivalent,false);
});
test('A valid artifact without a finish action cannot evade the turn limit',async()=>{
 const r=run();r.limits.steps=2;await executeRun(r,scripted([{tool:'write_file',args:{path:'normalized.csv',content:'id,amount_cents,status\nA01,123450,valid\nA02,1999,valid\nA03,0,valid\nA04,,invalid\nA05,,invalid\nA06,-1250,valid'}},null]));
 assert.equal(r.status,'error');assert.equal(r.error,'step_limit');assert.equal(r.result,null);
});
test('Repeated null responses stop with an explicit invalid-response error',async()=>{
 const r=run();await executeRun(r,scripted([null]));assert.equal(r.error,'invalid_response');assert.equal(r.calls.length,3);
});
const op=(name,...args)=>({op:name,args});
const paid=op('sub',op('add',5,op('mul',2,'weight')),op('if','member',3,0));
test('Shipping acceptance rejects a wrong threshold and capped paid charges',()=>{
 const t=TASKS.find(t=>t.id==='shipping-function');
 for(const expression of [op('if',op('gte','subtotal',99.995),0,paid),op('if',op('gte','subtotal',100),0,op('min',7,paid))])assert.equal(validate(t,{...t.inputs,[t.output]:JSON.stringify(expression)}).passed,false);
});
test('Agent check feedback excludes acceptance inputs and expected numeric values',async()=>{
 const r=run('shipping-function');r.files['shipping.json']=JSON.stringify(op('if',op('gte','subtotal',100),0,paid));
 const result=await toolAction(r,{tool:'check_result'});assert.equal(result.result.passed,true);
 const feedback=JSON.stringify(result.result);assert.equal(feedback.includes('Expected'),false);assert.equal(feedback.includes('subtotal 100'),false);
});
