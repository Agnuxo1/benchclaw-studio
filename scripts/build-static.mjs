// Builds the read-only replay site (GitHub Pages) from public/ and showcase/. No server, no inference.
// Usage: node scripts/build-static.mjs [outDir]
import {readFile,writeFile,mkdir,readdir,rm,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {TASKS} from '../server/tasks.mjs';
import {PROFILES,TOOL_LABELS} from '../server/engine.mjs';
import {MODELS,LADDER} from '../server/models.mjs';
const out=process.argv[2]||'site';
await rm(out,{recursive:true,force:true});await mkdir(join(out,'api','reports'),{recursive:true});
for(const f of ['app.js','style.css'])await cp(join('public',f),join(out,f));
let html=await readFile('public/index.html','utf8');
html=html.replace('<html lang="en">','<html lang="en" data-static="1">').replace('href="/style.css"','href="style.css"').replace('src="/app.js"','src="app.js"');
await writeFile(join(out,'index.html'),html);await writeFile(join(out,'.nojekyll'),'');
const runs=[];try{for(const f of await readdir('showcase/runs'))if(f.endsWith('.json'))runs.push(JSON.parse(await readFile(join('showcase/runs',f),'utf8')));}catch{}
let index=null;try{index=JSON.parse(await readFile('showcase/index.json','utf8'));}catch{}
const json=(p,v)=>writeFile(join(out,'api',p),JSON.stringify(v));
await json('catalog.json',{tasks:TASKS,profiles:PROFILES,toolLabels:TOOL_LABELS,models:MODELS,ladder:LADDER,publicMode:true,showcase:index?{runs:runs.length,generatedAt:index.generatedAt}:null,provider:{name:'Nebius Token Factory',model:MODELS.super.id,configured:false,enabled:false,creditBalance:null},limits:{maxRuns:0,usedRuns:0,perOwner:null,steps:12,timeoutSeconds:180,tokenBudget:null},enigmagent:{version:'3.0.0',vaultFormat:2,health:'real synthetic local service; no external credentials'}});
await json('runs.json',[]);await json('ladders.json',[]);
await json('showcase.json',index?{...index,runs}:{error:'no_showcase'});
for(const r of runs)await json(join('reports',r.id+'.json'),{format:'benchclaw-evidence-v1',exportedAt:index?.generatedAt,report:r,sha256:createHash('sha256').update(JSON.stringify(r)).digest('hex')});
console.log(`static site: ${out} · ${runs.length} recorded runs`);
