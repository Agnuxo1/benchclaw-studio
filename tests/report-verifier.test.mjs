import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeRun,compare} from '../server/engine.mjs';
import {TASKS,validate} from '../server/tasks.mjs';
import {verifyReport} from '../server/report-verifier.mjs';
const mk=()=>makeRun('invoice-cleanup','careful',['read_file','write_file','check_result'],'test','nvidia/test');
const envelope=r=>({format:'benchclaw-evidence-v1',report:r,sha256:createHash('sha256').update(JSON.stringify(r)).digest('hex')});
test('Offline verification recalculates checks and rejects tampering or false scores',()=>{
 const r=mk(),t=TASKS.find(t=>t.id===r.taskId);r.status='failed';r.result=validate(t,r.files);
 assert.equal(verifyReport(envelope(r)).verified,true);
 const original=envelope(r);original.report.status='passed';assert.throws(()=>verifyReport(original),/digest_mismatch/);
 r.status='passed';assert.equal(verifyReport(envelope(r)).verified,false);
 r.validatorFingerprint='old-validator';assert.throws(()=>verifyReport(envelope(r)),/incompatible/);
});
test('Old or changed runtime and inference conditions cannot compare as equivalent',()=>{
 const a=mk(),b=mk();assert.equal(compare(a,b).equivalent,true);
 b.inference.maxTokens=1024;assert.equal(compare(a,b).equivalent,false);
 b.inference={...a.inference};b.runtimeFingerprint='changed';assert.equal(compare(a,b).equivalent,false);
 delete a.runtimeFingerprint;delete b.runtimeFingerprint;assert.equal(compare(a,b).equivalent,false);
});
