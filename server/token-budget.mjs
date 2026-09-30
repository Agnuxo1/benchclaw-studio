import {randomUUID} from 'node:crypto';
function stop(code){const error=new Error(code);error.code=code;throw error;}
// Reservations bound application admissions, not a provider's invoice or tokenizer.
export class TokenBudget {
 constructor(limit,state={version:1,calls:[],blocked:null},persist=()=>{}){
  if(!Number.isSafeInteger(limit)||limit<0)throw new Error('Invalid token cap');
  if(state.version!==1||!Array.isArray(state.calls)||state.calls.some(c=>!Number.isSafeInteger(c.charge)||c.charge<0))throw new Error('Invalid token ledger');
  this.limit=limit;this.state=structuredClone(state);this.persist=persist;
  if(this.state.calls.some(c=>c.status==='reserved'))this.state.blocked='interrupted_call_unreconciled';
 }
 snapshot(){const charged=this.state.calls.reduce((sum,c)=>sum+c.charge,0);return {limit:this.limit,charged,remaining:Math.max(0,this.limit-charged),blocked:this.state.blocked,method:'UTF-8 prompt bytes + 4096 allowance + maximum output reserved before each call; reported tokens reconciled afterward. Not a monetary limit.'};}
 reserve(messages,maxTokens){
  if(this.state.blocked)stop('token_accounting_unknown');
  const charge=Buffer.byteLength(JSON.stringify(messages),'utf8')+4096+maxTokens;
  if(!Number.isSafeInteger(maxTokens)||maxTokens<1||!Number.isSafeInteger(charge)||charge>this.snapshot().remaining)stop('token_budget_exhausted');
  const call={id:randomUUID(),status:'reserved',charge,at:new Date().toISOString()};this.state.calls.push(call);
  try{this.persist(this.state);}catch{this.state.blocked='ledger_write_failed';stop('token_accounting_unknown');}
  return call.id;
 }
 settle(id,usage){
  const c=this.state.calls.find(c=>c.id===id);if(!c||c.status!=='reserved')throw new Error('Unknown token reservation');
  const total=usage?.total_tokens,input=usage?.prompt_tokens,output=usage?.completion_tokens;
  const known=[total,input,output].every(n=>Number.isSafeInteger(n)&&n>=0)&&total>=input+output;
  if(!known){c.status='unknown';this.state.blocked='provider_usage_unavailable';}
  else{const overrun=total>c.charge;c.charge=total;c.status='reported';if(overrun)this.state.blocked='reservation_exceeded';}
  this.persist(this.state);
  if(!known)stop('token_accounting_unknown');
  if(this.state.blocked)stop('token_budget_overrun');
 }
}
