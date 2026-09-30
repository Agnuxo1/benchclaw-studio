import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {makeRun} from '../server/engine.mjs';
test('Real HTTP API enforces session ownership, report redaction, origins and disabled inference',async()=>{
 await mkdir(resolve('artifacts'),{recursive:true});const dir=await mkdtemp(resolve('artifacts/http-test-'));
 const token='a'.repeat(64),owner=createHash('sha256').update(token).digest('hex');const fixture=makeRun('invoice-cleanup','careful',['read_file'],owner,'scripted-test-only');fixture.status='failed';fixture.error='scripted_test_fixture';
 await writeFile(join(dir,fixture.id+'.json'),JSON.stringify(fixture));
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:resolve('.'),env:{...process.env,NEBIUS_API_KEY:'',STUDIO_INFERENCE_ENABLED:'0',PORT:'4330',STUDIO_DATA:dir},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('startup_timeout')),10000);child.stdout.on('data',c=>{if(c.toString().includes('BenchClaw Studio http')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(new Error('server_exit'));});});
  const base='http://127.0.0.1:4330',headers={Cookie:`studio=${token}`};
  assert.equal((await fetch(base+'/')).status,200);
  const catalog=await (await fetch(base+'/api/catalog')).json();assert.equal(catalog.provider.enabled,false);assert.equal(JSON.stringify(catalog).includes('synthetic_service'),false);
  const list=await (await fetch(base+'/api/runs',{headers})).json();assert.equal(list.length,1);assert.equal(Object.hasOwn(list[0],'owner'),false);
  assert.equal((await fetch(base+'/api/runs/'+fixture.id)).status,404);
  assert.equal((await fetch(base+'/api/runs/'+fixture.id+'/report')).status,404);
  const report=await (await fetch(base+'/api/runs/'+fixture.id+'/report',{headers})).json();assert.equal(Object.hasOwn(report.report,'owner'),false);assert.equal(report.sha256,createHash('sha256').update(JSON.stringify(report.report)).digest('hex'));
  assert.equal((await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://malicious.invalid'},body:'{}'})).status,403);
  const denied=await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});assert.equal(denied.status,503);assert.equal((await denied.json()).error,'credentials_missing');
  assert.equal((await fetch(base+'/api/compare?a='+fixture.id+'&b='+fixture.id)).status,404);
  assert.equal((await fetch(base+'/.env')).status,404);
 }finally{child.kill();}
});
