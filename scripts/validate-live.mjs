// Calls only the running real application. No provider stubs or simulated success.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const base=process.env.STUDIO_BASE_URL||'http://127.0.0.1:4328';let cookie='';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('Use the local Studio endpoint');
async function call(path,body){const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{Origin:base,'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const value=await res.json();if(!res.ok)throw new Error(value.error);return value;}
const catalog=await call('/api/catalog');if(!catalog.provider.enabled)throw new Error('Real Nebius access and confirmed free credits are required; no mock validation is available.');
const dir=join('artifacts','live-validation-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(dir,{recursive:true});
const outcomes=[];
const comparisons=[];
const contractHashes={};
for(const id of ['INV-003','INV-004']){try{contractHashes[id]=createHash('sha256').update(await readFile(`coordinacion/tareas/${id}.md`)).digest('hex');}catch{throw new Error('Missing preregistered contract '+id);}}
const plans=[['release-brief','careful'],['release-brief','lean'],['release-brief','careful'],['release-brief','lean'],['release-brief','careful'],['release-brief','lean'],['invoice-cleanup','careful'],['shipping-function','careful']];
for(const [taskId,profile]of plans){
 const task=catalog.tasks.find(t=>t.id===taskId);let run=await call('/api/runs',{taskId,profile,allowedTools:task.tools});
 while(['queued','running'].includes(run.status)){await new Promise(r=>setTimeout(r,1200));run=await call('/api/runs/'+run.id);}
 const report=await call('/api/runs/'+run.id+'/report');await writeFile(join(dir,run.id+'.json'),JSON.stringify(report,null,2));
 const result={id:run.id,taskId,profile,status:run.status,error:run.error,checks:run.result?`${run.result.passedCount}/${run.result.total}`:null,tokens:run.tokens,durationMs:run.durationMs,providerCalls:run.calls.length,runtimeFingerprint:run.runtimeFingerprint,validatorFingerprint:run.validatorFingerprint};outcomes.push(result);console.log(JSON.stringify(result));
 if(taskId==='release-brief'&&profile==='lean'){const paired=outcomes[outcomes.length-2];const c=await call(`/api/compare?a=${paired.id}&b=${run.id}`);comparisons.push({a:paired.id,b:run.id,equivalent:c.equivalent,comparable:c.comparable,reason:c.reason});}
 if(run.status==='error')break;
}
const main=outcomes.filter(r=>r.taskId==='release-brief');
const contractPassed=main.length===6&&main.filter(r=>r.status==='passed').length>=5&&comparisons.length===3&&comparisons.every(c=>c.equivalent&&c.comparable)&&outcomes.length===8&&outcomes.slice(6).every(r=>r.status==='passed');
const summary={date:new Date().toISOString(),contractHashes,contractPassed,comparisons,methodology:'Three consecutive paired repetitions of the document task, then one run of each other task. Identical fixture, tools, validators and limits. Main-task threshold: at least 5/6 passed; both other tasks must pass. API equivalence and completed task outcomes required. No independent model ranking or scientific IQ claim.',provider:catalog.provider.name,model:catalog.provider.model,outcomes,limitations:'Small synthetic tasks; hosted serving variability; no billing receipt. This evaluates these executions only.'};
await writeFile(join(dir,'summary.json'),JSON.stringify(summary,null,2));console.log('Evidence written to '+dir);
if(!contractPassed)process.exitCode=1;
