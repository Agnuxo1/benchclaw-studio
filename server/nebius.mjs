import {requestJSON,ProviderError} from './http.mjs';
export const BASE_URL='https://api.tokenfactory.nebius.com/v1/';
export class NebiusClient {
  #getKey;#transport;
  constructor(getKey,model=process.env.NEBIUS_MODEL||'nvidia/nemotron-3-super-120b-a12b',transport=requestJSON){
    if(!/^nvidia\/[a-zA-Z0-9_.-]+$/.test(model))throw new Error('NVIDIA model required');
    this.model=model;this.#getKey=getKey;this.#transport=transport;
  }
  async complete(messages,{signal,temperature=0,maxTokens=2048}={}){
    const started=performance.now();const key=await this.#getKey();
    if(!key)throw new ProviderError('credentials_missing');
    let result;
    try{result=await this.#transport(BASE_URL+'chat/completions',{model:this.model,messages,temperature,max_tokens:maxTokens,response_format:{type:'json_object'}},{key,signal});}
    catch(error){error.evidence={provider:'Nebius Token Factory',model:this.model,requestId:null,status:error.status??null,durationMs:Math.round(performance.now()-started),usage:null,finishReason:null,error:error.code||'network_error'};throw error;}
    const content=result.choices?.[0]?.message?.content;
    const evidence={provider:'Nebius Token Factory',model:result.model||this.model,requestId:typeof result.id==='string'?result.id:null,status:200,durationMs:Math.round(performance.now()-started),usage:result.usage?{prompt_tokens:result.usage.prompt_tokens??null,completion_tokens:result.usage.completion_tokens??null,total_tokens:result.usage.total_tokens??null}:null,finishReason:result.choices?.[0]?.finish_reason??null};
    if(typeof content!=='string'||!content.trim()||result.choices?.[0]?.finish_reason!=='stop'){const error=new ProviderError('incomplete_response');error.evidence={...evidence,error:error.code};throw error;}
    return {content,evidence};
  }
}
