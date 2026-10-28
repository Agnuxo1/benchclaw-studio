import {requestJSON,ProviderError} from './http.mjs';
import {MODELS} from './models.mjs';
export const BASE_URL=process.env.NEBIUS_BASE_URL||'https://api.tokenfactory.nebius.com/v1/';
const ALLOWED=new Set(Object.values(MODELS).map(m=>m.id));
export class NebiusClient {
  #getKey;#transport;#budget;
  constructor(getKey,model=process.env.NEBIUS_MODEL||MODELS.super.id,transport=requestJSON,budget=null){
    if(!/^nvidia\/[a-zA-Z0-9_.-]+$/.test(model))throw new Error('NVIDIA model required');
    this.model=model;this.#getKey=getKey;this.#transport=transport;this.#budget=budget;
  }
  // A per-call model must be one of the published Nemotron tiers; the default model keeps the constructor contract.
  async complete(messages,{signal,temperature=0,maxTokens=8192,model=this.model,seed}={}){
    if(model!==this.model&&!ALLOWED.has(model))throw new ProviderError('model_not_allowed');
    const started=performance.now();const key=await this.#getKey();
    if(!key)throw new ProviderError('credentials_missing');
    const reservation=this.#budget?.reserve(messages,maxTokens);
    const body={model,messages,temperature,max_tokens:maxTokens,response_format:{type:'json_object'}};if(Number.isSafeInteger(seed))body.seed=seed;
    let result;
    try{result=await this.#transport(BASE_URL+'chat/completions',body,{key,signal});}
    catch(error){if(reservation){try{this.#budget.settle(reservation,null);}catch{}}error.evidence={provider:'Nebius Token Factory',model,requestId:null,status:error.status??null,durationMs:Math.round(performance.now()-started),usage:null,finishReason:null,error:error.code||'network_error'};throw error;}
    const content=result.choices?.[0]?.message?.content;
    const evidence={provider:'Nebius Token Factory',model:result.model||model,requestId:typeof result.id==='string'?result.id:null,status:200,durationMs:Math.round(performance.now()-started),usage:result.usage?{prompt_tokens:result.usage.prompt_tokens??null,completion_tokens:result.usage.completion_tokens??null,total_tokens:result.usage.total_tokens??null}:null,finishReason:result.choices?.[0]?.finish_reason??null};
    if(reservation){try{this.#budget.settle(reservation,result.usage);}catch(error){error.evidence={...evidence,error:error.code||'token_accounting_unknown'};throw error;}}
    if(typeof content!=='string'||!content.trim()||result.choices?.[0]?.finish_reason!=='stop'){const error=new ProviderError('incomplete_response');error.evidence={...evidence,error:error.code};throw error;}
    return {content,evidence};
  }
}
