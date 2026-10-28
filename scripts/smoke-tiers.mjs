#!/usr/bin/env node
// One tiny JSON-mode call per Nemotron tier: confirms model ids, usage reporting and finish_reason before a benchmark.
// Usage: NEBIUS_API_KEY=... node scripts/smoke-tiers.mjs [--out experiments/smoke.json]
import {writeFileSync} from 'node:fs';
import {MODELS,LADDER,callCost} from '../server/models.mjs';
const key=process.env.NEBIUS_API_KEY;if(!key){console.error('NEBIUS_API_KEY is required');process.exit(2);}
const base=(process.env.NEBIUS_BASE_URL||'https://api.tokenfactory.nebius.com/v1/').replace(/\/?$/,'/');
const headers={authorization:`Bearer ${key}`,'content-type':'application/json'};
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:null;
const listed=await fetch(base+'models',{headers}).then(async r=>({status:r.status,ids:r.ok?(await r.json()).data.map(m=>m.id).filter(id=>/nemotron/i.test(id)):[]}));
console.log('models',listed.status,listed.ids.join(', '));
const rows=[];
for(const tier of LADDER){
 const model=MODELS[tier].id,t0=performance.now();
 const r=await fetch(base+'chat/completions',{method:'POST',headers,body:JSON.stringify({model,temperature:0,max_tokens:400,seed:11,response_format:{type:'json_object'},messages:[{role:'system',content:'Reply with a JSON object only.'},{role:'user',content:'Return {"ok":true,"sum":17+25}.'}]})});
 const body=await r.json().catch(()=>({}));const ch=body.choices?.[0];
 const row={tier,model,status:r.status,listed:listed.ids.includes(model),ms:Math.round(performance.now()-t0),finish:ch?.finish_reason??null,content:(ch?.message?.content??'').slice(0,120),reasoning:Boolean(ch?.message?.reasoning_content||ch?.message?.reasoning),usage:body.usage??null,cost:callCost(model,body.usage),requestId:r.headers.get('x-request-id'),error:body.error?.message?.slice(0,160)??body.detail??null};
 rows.push(row);console.log(JSON.stringify(row));
}
if(out)writeFileSync(out,JSON.stringify({date:new Date().toISOString(),base,listed,rows},null,1)+'\n');
process.exit(rows.every(r=>r.status===200)?0:1);
