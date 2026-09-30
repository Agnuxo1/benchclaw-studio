import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRun,executeRun} from '../server/engine.mjs';
test('Token guard failures retain understandable error codes and no task score',async()=>{
 for(const code of ['token_budget_exhausted','token_accounting_unknown','token_budget_overrun']){
  const r=makeRun('invoice-cleanup','careful',['read_file'],'test','nvidia/test');
  await executeRun(r,{model:'nvidia/test',complete:async()=>{const e=new Error(code);e.code=code;throw e;}});
  assert.equal(r.error,code);assert.equal(r.status,'error');assert.equal(r.result,null);
 }
});
