import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root } from './helpers.mjs';
const files=['tools/bundle-lab-assets.cjs'];
for(const dir of ['lab','lab/materials','tests/lab'])for(const item of await readdir(path.join(root,dir),{withFileTypes:true}))if(item.isFile()&&/\.(m?js)$/.test(item.name))files.push(path.join(dir,item.name));
for(const file of files)execFileSync(process.execPath,['--check',path.join(root,file)]);
console.log('node --check:',files.length,'R0-A scripts PASS (parallel lab/audio/ excluded)');
