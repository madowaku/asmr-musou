import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {chromium} from 'playwright';
import {openLab,root} from './helpers.mjs';
const context={window:{LAB:{}}};vm.runInNewContext(await readFile(root+'/lab/outlines.js','utf8'),context);
const outlines=context.window.LAB.outlines;assert.equal(Object.keys(outlines).length,16);
for(const [key,o] of Object.entries(outlines)){assert(o.vertices>=32&&o.vertices<=64);assert(o.coverage>=.95);const data=await readFile(root+'/assets/v03/body/'+key+'.png');assert.equal(createHash('sha256').update(data).digest('hex'),o.sourceSHA256);}
execFileSync('python',[root+'/tests/lab/outlines.py'],{stdio:'inherit'});
vm.runInNewContext(await readFile(root+'/lab/assets-bundle.js','utf8'),context);
assert.equal(Object.keys(context.window.LAB_ASSETS).length,27);assert((await stat(root+'/lab/assets-bundle.js')).size<3500000);
for(const [name,url] of Object.entries(context.window.LAB_ASSETS)){assert.equal(Buffer.from(url.split(',')[1],'base64').compare(await readFile(root+'/assets/v03/bundle/'+name+'.png')),0);assert(!name.startsWith('src/'));}
const browser=await chromium.launch({channel:'chrome'});
try{const {page,errors,network}=await openLab(browser);const result=await page.evaluate(()=>({status:LAB.assetStatus,image:LAB.tex('wax_body') instanceof HTMLImageElement,gl:LAB.renderer.gl.getError()}));assert.equal(result.status.bundled,27);assert.deepEqual(result.status.failed,[]);assert(result.image);assert.equal(result.gl,0);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);}finally{await browser.close();}
console.log('Assets: 16 outlines; original hash parity; 27 derived images; file:// WebGL PASS');
