import {createHash} from 'node:crypto';
import {TASKS,fingerprint,validate} from './tasks.mjs';
import {VALIDATOR_FINGERPRINT} from './versions.mjs';
export function verifyReport(envelope){
 if(envelope?.format!=='benchclaw-evidence-v1'||!envelope.report)throw new Error('unsupported_report');
 const r=envelope.report;
 if(createHash('sha256').update(JSON.stringify(r)).digest('hex')!==envelope.sha256)throw new Error('digest_mismatch');
 const task=TASKS.find(t=>t.id===r.taskId);
 if(!task||r.fingerprint!==fingerprint(task)||r.validatorFingerprint!==VALIDATOR_FINGERPRINT)throw new Error('incompatible_task_or_validator');
 if(!['passed','failed'].includes(r.status))throw new Error('task_not_evaluated');
 if(!r.files||typeof r.files!=='object'||!Array.isArray(r.events))throw new Error('invalid_artifacts');
 const result=validate(task,r.files,r.events);
 const checksConsistent=JSON.stringify(result)===JSON.stringify(r.result);
 const statusConsistent=r.status===(result.passed?'passed':'failed');
 return {digestMatches:true,task:r.taskId,checksConsistent,statusConsistent,recomputed:result,verified:checksConsistent&&statusConsistent,limitations:'The digest is not a signature. Offline verification recomputes artifact checks; it does not authenticate provider receipts, establish authorship, or prove general prose truth.'};
}
