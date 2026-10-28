// Copies a finished experiment into showcase/ for the read-only evidence gallery.
// Usage: node scripts/publish-showcase.mjs experiments/E01
//        node scripts/publish-showcase.mjs experiments/E02 --summary experiments/E02/summary-combined.json --runs experiments/E02/runs,experiments/E02b/runs
import {readFile,writeFile,mkdir,rm,realpath} from 'node:fs/promises';
import {join,sep} from 'node:path';
import {mergeRuns} from './summarize.mjs';
const arg=(n,f)=>{const i=process.argv.indexOf('--'+n);return i>0?process.argv[i+1]:f;};
const dir=process.argv[2]||'experiments/E01';
const summary=JSON.parse(await readFile(arg('summary',join(dir,'summary.json')),'utf8'));
const root=await realpath('.'),parent=await realpath('showcase');
if(!parent.startsWith(root+sep))throw new Error('Showcase must remain inside this checkout');
const target=join(parent,'runs');await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
// Primary replay preserves provider attempts. Raw history and explicit recovery remain in experiments/.
const runs=mergeRuns(arg('runs',join(dir,'runs')).split(','));
for(const {owner,...run} of runs)await writeFile(join('showcase/runs',run.id+'.json'),JSON.stringify(run));
summary.runs=runs.length;
await writeFile('showcase/index.json',JSON.stringify({experiment:dir.split(/[\/]/).pop(),generatedAt:summary.generatedAt,summary},null,1));
console.log(`showcase: ${runs.length} runs from ${dir}`);
