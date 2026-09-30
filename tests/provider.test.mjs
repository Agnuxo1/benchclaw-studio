import test from 'node:test';
import assert from 'node:assert/strict';
import {NebiusClient} from '../server/nebius.mjs';
import {ProviderError} from '../server/http.mjs';
const model='nvidia/nemotron-3-super-120b-a12b';
test('Provider adapter captures receipts and only explicitly reported tokens',async()=>{
 let captured;
 const client=new NebiusClient(async()=>'synthetic-test-key',model,async(url,body,options)=>{captured={url,body,options};return {id:'scripted-response',model,choices:[{message:{content:'{"finish":true}'},finish_reason:'stop'}],usage:{total_tokens:8}};});
 const result=await client.complete([{role:'user',content:'test'}]);assert.equal(result.evidence.provider,'Nebius Token Factory');assert.equal(result.evidence.usage.prompt_tokens,null);assert.equal(result.evidence.usage.total_tokens,8);assert.equal(captured.url,'https://api.tokenfactory.nebius.com/v1/chat/completions');assert.equal(captured.body.model,model);assert.equal(JSON.stringify(result).includes('synthetic-test-key'),false);
});
for(const [code,status]of [['authentication_failed',401],['rate_limited',429],['network_error',null],['provider_timeout',null],['invalid_response',null]])test('Provider adapter preserves redacted '+code,async()=>{
 const client=new NebiusClient(async()=>'synthetic-test-key',model,async()=>{throw new ProviderError(code,status);});await assert.rejects(()=>client.complete([]),e=>e.code===code&&e.evidence.status===status&&e.evidence.durationMs>=0&&!JSON.stringify(e.evidence).includes('synthetic-test-key'));
});
test('Truncation is not accepted as a finished result',async()=>{const client=new NebiusClient(async()=>'synthetic-test-key',model,async()=>({choices:[{message:{content:'{"tool":'},finish_reason:'length'}],usage:{total_tokens:2048}}));await assert.rejects(()=>client.complete([]),e=>e.code==='incomplete_response'&&e.evidence.usage.total_tokens===2048);});
test('Missing key never makes a transport call',async()=>{let called=false;const client=new NebiusClient(async()=>null,model,async()=>{called=true;});await assert.rejects(()=>client.complete([]),e=>e.code==='credentials_missing');assert.equal(called,false);});
