import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
const files=['index.mjs','engine.mjs','tasks.mjs','nebius.mjs','http.mjs','token-budget.mjs','versions.mjs','../vendor/enigmagent/vault-core.js','../vendor/enigmagent/operation-broker.js','../vendor/enigmagent/gateway-policy.js'];
// Normalize line endings so identical code compares across Windows/Linux checkouts.
export const SOURCE_HASHES=Object.fromEntries(files.map(name=>[name,digest(readFileSync(new URL(name,import.meta.url),'utf8').replace(/\r\n/g,'\n'))]));
export const RUNTIME_FINGERPRINT=digest(JSON.stringify(SOURCE_HASHES));
export const VALIDATOR_FINGERPRINT=SOURCE_HASHES['tasks.mjs'];
