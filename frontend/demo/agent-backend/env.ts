import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Keep credentials on the server. A worktree may reuse the main checkout's
// ignored .env without copying it or exposing it through Vite.
const root=fileURLToPath(new URL('../',import.meta.url));
let sharedRoot=root;
try {sharedRoot=path.dirname(execFileSync('git',['rev-parse','--path-format=absolute','--git-common-dir'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim());}catch{/* Packaged production builds may not include Git. */}
const candidates=[process.env.HEADS_UP_ENV_FILE,path.join(root,'.env'),path.join(root,'scripts/.env'),path.join(sharedRoot,'.env'),path.join(sharedRoot,'scripts/.env')];
for(const file of new Set(candidates.filter((value):value is string=>Boolean(value)))) {
  if(existsSync(file))process.loadEnvFile(file);
}
