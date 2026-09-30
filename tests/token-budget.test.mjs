import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenBudget} from '../server/token-budget.mjs';
import {NebiusClient} from '../server/nebius.mjs';
test('Concurrent reservations count before network and persist across reload',()=>{
 let saved;const b=new TokenBudget(9000,undefined,s=>{saved=structuredClone(s);});b.reserve([],1000);
 assert.throws(()=>b.reserve([],1000),/token_budget_exhausted/);
 const reloaded=new TokenBudget(9000,saved);assert.throws(()=>reloaded.reserve([],100),/token_accounting_unknown/);
});
test('Reported tokens reconcile; unknown usage and overruns block further calls',()=>{
 const b=new TokenBudget(10000);const id=b.reserve([],100);b.settle(id,{prompt_tokens:10,completion_tokens:5,total_tokens:15});assert.equal(b.snapshot().charged,15);
 const second=b.reserve([],100);assert.throws(()=>b.settle(second,null),/token_accounting_unknown/);assert.throws(()=>b.reserve([],100),/token_accounting_unknown/);
 const c=new TokenBudget(10000);const third=c.reserve([],100);assert.throws(()=>c.settle(third,{prompt_tokens:5000,completion_tokens:100,total_tokens:5100}),/token_budget_overrun/);
});
test('Disabled budget makes no provider request; failed transport blocks future admissions',async()=>{
 let calls=0;const zero=new TokenBudget(0);const client=new NebiusClient(async()=>'synthetic-only','nvidia/test',async()=>{calls++;},zero);
 await assert.rejects(client.complete([]),/token_budget_exhausted/);assert.equal(calls,0);
 const budget=new TokenBudget(10000);const failed=new NebiusClient(async()=>'synthetic-only','nvidia/test',async()=>{calls++;throw new Error('network_error');},budget);
 await assert.rejects(failed.complete([]),/network_error/);await assert.rejects(failed.complete([]),/token_accounting_unknown/);assert.equal(calls,1);
});
