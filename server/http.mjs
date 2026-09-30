// Adapted from BenchClaw cli/index.js (MIT). Bounded responses, cancellation,
// redacted errors and strict status handling added for Studio.
import https from 'node:https';
export class ProviderError extends Error { constructor(code,status=null){super(code);this.code=code;this.status=status;} }
export function requestJSON(url, body, {key,signal,timeoutMs=45000}={}) {
  return new Promise((resolve,reject)=>{
    let done=false,timer;
    const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);e?reject(e):resolve(v);};
    const payload=Buffer.from(JSON.stringify(body));
    const req=https.request(url,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':payload.length,'User-Agent':'benchclaw-studio/0.1',Authorization:`Bearer ${key}`}},res=>{
      const chunks=[];let size=0;
      res.on('data',c=>{size+=c.length;if(size>2*1024*1024){finish(new ProviderError('response_too_large'));req.destroy();}else chunks.push(c);});
      res.on('aborted',()=>finish(new ProviderError('incomplete_response')));
      res.on('error',()=>finish(new ProviderError('network_error')));
      res.on('end',()=>{
        if(res.statusCode!==200){finish(new ProviderError(res.statusCode===401?'authentication_failed':res.statusCode===429?'rate_limited':'provider_error',res.statusCode));return;}
        try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{finish(new ProviderError('invalid_response'));}
      });
    });
    function abort(){finish(new ProviderError('cancelled'));req.destroy();}
    timer=setTimeout(()=>{finish(new ProviderError('provider_timeout'));req.destroy();},timeoutMs);
    req.on('error',()=>finish(new ProviderError('network_error')));
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted){abort();return;}req.end(payload);
  });
}
