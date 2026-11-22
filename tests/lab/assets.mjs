import assert from 'node:assert/strict';
import { mkdtemp,mkdir,copyFile,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { root } from './helpers.mjs';
const temporary=await mkdtemp(path.join(tmpdir(),'asmr-lab-assets-'));
// Isolated fixture: never write into the concurrent art worker's assets/v03.
const ownFiles=['lab.html','tools/bundle-lab-assets.cjs','lab/slice.js','lab/events.js','lab/assets.js','lab/gl.js','lab/audio.js','lab/main.js','lab/lab.css','lab/materials/wax.js','lab/materials/jelly.js'];
let browser;
try{
  for(const file of ownFiles){await mkdir(path.dirname(path.join(temporary,file)),{recursive:true});await copyFile(path.join(root,file),path.join(temporary,file));}
  await mkdir(path.join(temporary,'assets/v03/nested'),{recursive:true});
  browser=await chromium.launch({channel:'chrome'});const fixture=await browser.newPage({offline:true});
  const encoded=await fixture.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.fillStyle='#ffe8a0';g.fillRect(0,0,8,8);return c.toDataURL('image/png').split(',')[1];});await fixture.close();const png=Buffer.from(encoded,'base64');
  await writeFile(path.join(temporary,'assets/v03/wax_body.png'),png);await writeFile(path.join(temporary,'assets/v03/nested/probe.PNG'),png);await writeFile(path.join(temporary,'assets/v03/ignored.txt'),'fixture');
  execFileSync(process.execPath,[path.join(temporary,'tools/bundle-lab-assets.cjs')]);const script=await readFile(path.join(temporary,'lab/assets-bundle.js'),'utf8'),context={window:{}};vm.runInNewContext(script,context);assert.deepEqual(Object.keys(context.window.LAB_ASSETS).sort(),['nested/probe','wax_body']);assert.equal(context.window.LAB_ASSETS.wax_body,'data:image/png;base64,'+png.toString('base64'));
  const page=await browser.newPage({offline:true}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(pathToFileURL(path.join(temporary,'lab.html')).href);await page.waitForFunction(()=>LAB.ready);
  const result=await page.evaluate(()=>({status:LAB.assetStatus,bundledTexture:LAB.tex('wax_body') instanceof HTMLImageElement,fallback:LAB.tex('jelly_body') instanceof HTMLCanvasElement,glError:LAB.renderer.gl.getError()}));assert.equal(result.status.bundled,2);assert.equal(result.status.failed.length,0);assert(result.bundledTexture&&result.fallback);assert.equal(result.glError,0);assert.deepEqual(errors,[]);console.log('Assets: nested PNG byte parity; bundled Image + procedural fallback; file:// WebGL upload PASS');
}finally{if(browser)await browser.close();const target=path.resolve(temporary),base=path.resolve(tmpdir())+path.sep;assert(target.startsWith(base)&&path.basename(target).startsWith('asmr-lab-assets-'));await rm(target,{recursive:true,force:true});}
