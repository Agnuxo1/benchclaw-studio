import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {isNotExecuted,mergeRuns,summarize} from '../scripts/summarize.mjs';
import {evaluatePolicy} from '../server/ladder.mjs';

test('Error codes do not erase provider attempts; recovery is explicitly secondary',t=>{
 const root=resolve(process.cwd());const dir=mkdtempSync(join(root,'.summary-test-'));
 t.after(()=>{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true});});
 const a=join(dir,'a'),b=join(dir,'b');mkdirSync(a);mkdirSync(b);
 const first={id:'first',tier:'lightning',taskId:'task',profile:'lean',inference:{seed:1},status:'error',error:'token_budget_overrun',calls:[{status:200}]};
 const retry={...first,id:'retry',status:'passed',error:null,calls:[{status:200}]};
 writeFileSync(join(a,'first.json'),JSON.stringify(first));writeFileSync(join(b,'retry.json'),JSON.stringify(retry));
 assert.equal(isNotExecuted(first),false);
 assert.equal(isNotExecuted({...first,calls:[]}),true);
 assert.equal(isNotExecuted({...first,calls:undefined}),false);
 const audit={};assert.equal(mergeRuns([a,b],{audit})[0].id,'first');
 assert.equal(audit.replacements.length,0);
 const secondary={};assert.equal(mergeRuns([a,b],{recoverLedgerFailures:true,audit:secondary})[0].id,'retry');
 assert.equal(secondary.replacements[0].previousProviderCalls,1);
 writeFileSync(join(a,'first.json'),JSON.stringify({...first,calls:[]}));
 assert.equal(mergeRuns([a,b])[0].id,'retry');
});

test('Offline routing obeys the same budget halt as the live ladder',()=>{
 const grid={lightning:{status:'error',error:'token_accounting_unknown',cost:null,durationMs:3},super:{status:'passed',cost:1,durationMs:2},ultra:{status:'passed',cost:9,durationMs:1}};
 const r=evaluatePolicy(grid);assert.equal(r.chosenTier,null);
 assert.equal(r.halted,true);assert.deepEqual(r.path,['lightning']);assert.equal(r.cost,null);
});

test('Cost contrasts use identical cells and disclose unknown costs',()=>{
 const rows=[];
 for(const seed of [1,2])for(const tier of ['lightning','super','ultra'])rows.push({tier,taskId:'task',profile:'lean',inference:{seed},status:tier==='lightning'&&seed===2?'failed':'passed',cost:tier==='lightning'?(seed===1?1:null):tier==='ultra'?(seed===1?10:100):5,durationMs:10});
 const s=summarize(rows,{tiers:['lightning','super','ultra'],seeds:[1,2],profiles:['lean'],tasks:['task']});
 assert.deepEqual(s.policies.ladder.costCoverage,{knownCells:1,totalCells:2,complete:false});
 const p=s.pairedCostComparisons.ladder_vs_always_ultra;
 assert.equal(p.knownPairs,1);assert.equal(p.controlMeanUSD,10);
 assert.equal(p.ladderMeanUSD,1);assert.equal(p.relativeSaving,.9);
 assert.equal(s.byTier.lightning.costUSD.knownRuns,1);
});

test('Recorded E02 attempts remain in primary analysis and preserve the positive effect',()=>{
 const dirs=['experiments/E02/runs','experiments/E02b/runs'];const audit={};
 const rows=mergeRuns(dirs,{audit});assert.equal(audit.providerAttemptedRuns,56);
 assert.equal(audit.replacements.length,22);
 assert.ok(audit.replacements.every(r=>r.previousProviderCalls===0));
 const s=summarize(rows,{tiers:['lightning','super','ultra'],seeds:[11,22,33],profiles:['careful','lean'],tasks:['invoice-cleanup','release-brief','shipping-function']});
 assert.ok(Math.abs(s.policies.ladder.passRate.mean-15/18)<1e-12);
 assert.ok(Math.abs(s.policies.always_ultra.passRate.mean-14/18)<1e-12);
 const p=s.pairedCostComparisons.ladder_vs_always_ultra;
 assert.equal(p.knownPairs,17);assert.ok(Math.abs(p.relativeSaving-.321534225485552)<1e-12);
 const recovered=mergeRuns(dirs,{recoverLedgerFailures:true});
 const r=summarize(recovered,{tiers:['lightning','super','ultra'],seeds:[11,22,33],profiles:['careful','lean'],tasks:['invoice-cleanup','release-brief','shipping-function']});
 assert.ok(Math.abs(r.policies.ladder.passRate.mean-16/18)<1e-12);
});
