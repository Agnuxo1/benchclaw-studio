import {readFile} from 'node:fs/promises';
import {verifyReport} from '../server/report-verifier.mjs';
try{
 if(!process.argv[2])throw new Error('usage: node scripts/verify-report.mjs report.json');
 const result=verifyReport(JSON.parse(await readFile(process.argv[2],'utf8')));
 console.log(JSON.stringify(result,null,2));if(!result.verified)process.exitCode=1;
}catch(error){console.error(JSON.stringify({verified:false,error:error.message}));process.exitCode=1;}
