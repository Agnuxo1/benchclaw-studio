import test from 'node:test';
import assert from 'node:assert/strict';
import {TASKS,validate,evaluateExpression} from '../server/tasks.mjs';
import {makeRun,toolAction,executeRun,compare} from '../server/engine.mjs';
const model='nvidia/nemotron-3-super-120b-a12b';
const run=(id='invoice-cleanup',tools=['read_file','write_file','check_result'])=>makeRun(id,'careful',tools,'test-owner',model);
test('File boundary rejects traversal, unknown tool and writes to inputs',async()=>{
 const r=run();for(const a of [{tool:'read_file',args:{path:'../.env'}},{tool:'write_file',args:{path:'invoices.csv',content:'altered'}},{tool:'reveal_secret',args:{}}])assert.equal((await toolAction(r,a)).status,'denied');
 assert.equal(r.files['invoices.csv'],TASKS[1].inputs['invoices.csv']);
});
test('Revoked write permission cannot write',async()=>{const r=run('invoice-cleanup',['read_file']);assert.equal((await toolAction(r,{tool:'write_file',args:{path:'normalized.csv',content:'x'}})).status,'denied');});
test('Exact invoice validator accepts fixture and rejects row loss',()=>{
 const t=TASKS[1],files={...t.inputs,'normalized.csv':'id,amount_cents,status\nA01,123450,valid\nA02,1999,valid\nA03,0,valid\nA04,,invalid\nA05,,invalid\nA06,-1250,valid'};assert.equal(validate(t,files).passed,true);files['normalized.csv']=files['normalized.csv'].replace('A03,0,valid\n','');assert.equal(validate(t,files).passed,false);
});
test('Exact source citations reject fabricated quote and injection citation',()=>{
 const t=TASKS[0];const citations=[2,3,4,5,6].map(line=>({file:'release-policy.txt',line,quote:t.inputs['release-policy.txt'].split('\n')[line-1]}));citations.push({file:'handover.txt',line:2,quote:t.inputs['handover.txt'].split('\n')[1]});
 const answer='A passing test suite and service owner approval are required. Roll back above 2% for five minutes. Restore the previous signed artifact, notify the on-call engineer and include the digest and test report.';
 const result=()=>validate(t,{...t.inputs,'brief.json':JSON.stringify({answer,citations})});assert.equal(result().passed,true);citations[0].quote='invented';assert.equal(result().passed,false);
});
test('Restricted programming executes rules without host code',()=>{
 const tree={op:'if',args:[{op:'gte',args:['subtotal',100]},0,{op:'max',args:[0,{op:'sub',args:[{op:'add',args:[5,{op:'mul',args:[2,'weight']}]},{op:'if',args:['member',3,0]}]}]}]};
 assert.equal(validate(TASKS[2],{...TASKS[2].inputs,'shipping.json':JSON.stringify(tree)}).passed,true);
 assert.throws(()=>evaluateExpression({op:'eval',args:['process.env']},{}));assert.throws(()=>evaluateExpression('constructor',{}));
});
test('Comparison requires identical tools and task fingerprints',()=>{const a=run(),b=run();b.profile='lean';assert.equal(compare(a,b).equivalent,true);b.allowedTools=['read_file'];assert.equal(compare(a,b).equivalent,false);});
test('Provider failure stays failure, never fabricated success',async()=>{const r=run();await executeRun(r,{model,complete:async()=>{throw new Error('authentication_failed');}});assert.equal(r.status,'error');assert.equal(r.error,'authentication_failed');assert.equal(r.calls.length,0);});
test('Cancelled runs do not commit late provider responses',async()=>{const r=run(),c=new AbortController();const client={model,complete:async()=>{c.abort();return {content:JSON.stringify({tool:'write_file',args:{path:'normalized.csv',content:'late'}}),evidence:{}};}};await executeRun(r,client,{signal:c.signal});assert.equal(r.status,'cancelled');assert.equal(r.files['normalized.csv'],undefined);});
test('Tool execution cannot leak data between run maps',async()=>{const a=run(),b=run();await toolAction(a,{tool:'write_file',args:{path:'normalized.csv',content:'private output'}});assert.equal(b.files['normalized.csv'],undefined);});
test('Unbounded and nonfinite expressions are refused',()=>{let tree=1;for(let i=0;i<26;i++)tree={op:'add',args:[tree,1]};assert.throws(()=>evaluateExpression(tree,{}));assert.throws(()=>evaluateExpression({op:'div',args:[1,0]},{}));});
test('Unsupported profile keys are rejected',()=>{assert.throws(()=>makeRun('release-brief','toString',[],'owner',model));});
