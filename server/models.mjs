// NVIDIA Nemotron tiers served by Nebius Token Factory, cheapest first.
// Prices are USD per 1M uncached tokens from the Token Factory model catalog (checked 2026-10-28); null means unverified, so cost stays unknown.
export const MODELS={
 lightning:{id:'nvidia/Nemotron-3_5-Lightning',label:'Nemotron 3.5 Lightning',size:'30B total · 3B active',price:{input:0.06,output:0.24}},
 super:{id:'nvidia/nemotron-3-super-120b-a12b',label:'Nemotron 3 Super',size:'120B total · 12B active',price:{input:0.3,output:0.9}},
 ultra:{id:'nvidia/Nemotron-3-Ultra-550b-a55b',label:'Nemotron 3 Ultra',size:'550B total · 55B active',price:{input:1,output:3}}
};
export const LADDER=['lightning','super','ultra'];
// STUDIO_PRICES='{"lightning":{"input":0.1,"output":0.4}}' overrides a tier price after checking the provider's price list.
try{for(const [tier,p] of Object.entries(JSON.parse(process.env.STUDIO_PRICES||'{}')))if(MODELS[tier]&&Number.isFinite(p.input)&&Number.isFinite(p.output))MODELS[tier].price={input:p.input,output:p.output};}catch{throw new Error('Invalid STUDIO_PRICES');}
export const tierOf=id=>Object.keys(MODELS).find(t=>MODELS[t].id===id)||null;
export function callCost(model,usage){
 const p=MODELS[tierOf(model)]?.price;
 if(!p||p.input===null||!Number.isFinite(usage?.prompt_tokens)||!Number.isFinite(usage?.completion_tokens))return null;
 return (usage.prompt_tokens*p.input+usage.completion_tokens*p.output)/1e6;
}
export function runCost(calls){const costs=calls.map(c=>callCost(c.model,c.usage));return costs.length&&costs.every(Number.isFinite)?costs.reduce((a,b)=>a+b,0):null;}
