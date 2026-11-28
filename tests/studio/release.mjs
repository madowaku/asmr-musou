import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const build = execFileSync('python',['tools/build-release.py'],{encoding:'utf8'}).trim();
const extracted = await mkdtemp(path.join(tmpdir(),'crunch-zip-'));
const servers = [];
async function serve(handler) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:' + server.address().port;
}
const browser = await chromium.launch({channel:'chrome'});
try {
  execFileSync('python',['-m','zipfile','-e',path.join(build,'asmr-musou-v1.5-html5.zip'),extracted]);
  const missing = [];
  const mime = {'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.html':'text/html'};
  const game = await serve(async(req,res)=>{
    const name = new URL(req.url,'http://localhost').pathname.slice('/upload/123/'.length);
    try {
      if (!req.url.startsWith('/upload/123/') || name.includes('..')) throw Error('path');
      const bytes = await readFile(path.join(extracted,name));
      assert.deepEqual(bytes,await readFile(path.join(build,'pages',name)));
      res.writeHead(200,{'Content-Type':mime[path.extname(name)]}); res.end(bytes);
    } catch { missing.push(req.url); res.writeHead(404); res.end(); }
  });
  const host = await serve((_req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>*{box-sizing:border-box}body{margin:0}iframe{width:360px;height:640px;border:0}iframe:fullscreen{width:100%;height:100%}</style><button onclick="document.querySelector(\'iframe\').requestFullscreen()">Fullscreen</button><br><iframe allowfullscreen allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin allow-downloads" src="'+game+'/upload/123/index.html?test=1&all=1&sound=C"></iframe>');
  });
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host.replace('127.0.0.1','localhost'));
  const frame=page.frames().find(f=>f.parentFrame());
  await frame.locator('#title').waitFor();
  assert.deepEqual(await frame.evaluate(()=>[innerWidth,innerHeight,typeof StudioTest,StudioSound.mode]),[360,640,'undefined','A']);
  await page.getByText('Fullscreen',{exact:true}).tap();
  await page.waitForFunction(()=>document.fullscreenElement?.tagName==='IFRAME');
  await frame.waitForFunction(()=>innerWidth>=390 && innerHeight>=844);
  await frame.locator('#adventure').tap();
  await frame.locator('#hero-cards [data-hero=crusher]').tap();
  await frame.locator('#hero-confirm').tap();
  assert.equal(await frame.locator('#stage-cards button:enabled').count(),1);
  await frame.locator('#stage-cards button').first().tap();
  await frame.evaluate(()=>{
    const ctx=LAB.audio.context, analyser=ctx.createAnalyser();
    ctx.createMediaStreamSource(LAB.audio.captureStream()).connect(analyser);
    const data=new Float32Array(analyser.fftSize);
    window.samplePeak=()=>{analyser.getFloatTimeDomainData(data);return data.some(x=>Math.abs(x)>.00001);};
  });
  const box=await frame.locator('#scene').boundingBox();
  await page.touchscreen.tap(box.x+box.width*345/720,box.y+box.height*613/1280);
  await frame.waitForFunction(()=>window.samplePeak());
  await frame.waitForFunction(()=>Number(document.querySelector('#kills').textContent)>0);
  // Use a completed-stage fixture to exercise persistent unlocks and the film UI.
  await frame.evaluate(()=>{const p=StudioContent.load();p.cleared=[1];StudioContent.save(p);location.reload();});
  await frame.locator('#collection').tap();
  assert.equal(await frame.locator('#material-cards button:enabled').count(),1);
  await frame.locator('#film-mode').check();
  await frame.locator('#book-confirm').tap();
  assert.equal(await frame.locator('#hero-cards [aria-pressed=true]').getAttribute('data-hero'),'crusher');
  await frame.locator('#hero-confirm').tap();
  await frame.locator('#film-aftermath').tap();
  const ready = page.waitForEvent('download');
  await frame.locator('#aftermath-save').tap();
  const png=await readFile(await (await ready).path());
  assert.equal(png.toString('ascii',12,16),'IHDR');
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[720,1280]);
  assert.deepEqual(missing,[]);
  assert.deepEqual(errors,[]);
  console.log('Extracted ZIP passed embedded/fullscreen touch, PCM output, saved unlock and PNG download.');
} finally {
  await browser.close();
  for(const server of servers) server.close();
  await rm(extracted,{recursive:true,force:true});
}
