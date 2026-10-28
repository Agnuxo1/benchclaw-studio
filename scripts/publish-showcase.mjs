// Copies a finished experiment into showcase/ for the read-only evidence gallery.
// Usage: node scripts/publish-showcase.mjs experiments/E01
import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
const dir=process.argv[2]||'experiments/E01';
const summary=JSON.parse(await readFile(join(dir,'summary.json'),'utf8'));
await rm('showcase/runs',{recursive:true,force:true});await mkdir('showcase/runs',{recursive:true});
let n=0;for(const f of await readdir(join(dir,'runs'))){if(!f.endsWith('.json'))continue;const {owner,...run}=JSON.parse(await readFile(join(dir,'runs',f),'utf8'));await writeFile(join('showcase/runs',f),JSON.stringify(run));n++;}
summary.runs=n;
await writeFile('showcase/index.json',JSON.stringify({experiment:dir.split(/[\/]/).pop(),generatedAt:summary.generatedAt,summary},null,1));
console.log(`showcase: ${n} runs from ${dir}`);
