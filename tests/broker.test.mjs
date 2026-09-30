import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {VaultManager,MemoryStorage} from '../vendor/enigmagent/vault-core.js';
import {OperationBroker} from '../vendor/enigmagent/operation-broker.js';
test('Real EnigmAgent vault and broker attach a synthetic credential and discard a reflected body',async()=>{
 const credential='synthetic-only-test-value';let authorized=false;
 const server=http.createServer((req,res)=>{authorized=req.headers.authorization===`Bearer ${credential}`;res.writeHead(authorized?200:401);res.end(`reflected-secret:${credential}`);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const vault=new VaultManager(new MemoryStorage());await vault.create('test-studio','synthetic-password-only');await vault.addSecret({name:'fixture',domain:'127.0.0.1',value:credential});
  assert.equal(JSON.stringify(vault.vault).includes(credential),false);
  const broker=new OperationBroker({vault,allowLoopback:true,operations:[{name:'health',url:`http://127.0.0.1:${server.address().port}/health`,secret:'fixture'}]});
  const result=await broker.execute('health');assert.equal(authorized,true);assert.deepEqual(result,{operation:'health',status:200,ok:true});assert.equal(JSON.stringify(result).includes(credential),false);
  await assert.rejects(()=>broker.execute('reveal_secret'));vault.lock();await assert.rejects(()=>broker.execute('health'));
 }finally{await new Promise(r=>server.close(r));}
});
