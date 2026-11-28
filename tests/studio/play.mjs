import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const base = process.env.STUDIO_PREVIEW_URL || new URL('../../studio.html', import.meta.url).href;
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = name => shots && page.screenshot({ path: path.join(shots, name + '.png') });
  if(shots)await page.exposeBinding('studioShot', (_source,name) => shot(name));
  const click = id => page.locator('#' + id).tap();
  const choose = id => page.locator('[data-hero="' + id + '"]').tap();
  const openStage = number => page.locator('#stage-cards [data-stage="' + number + '"]').tap();
  const goto = async test => {
    const url = new URL(base);
    if (test) url.searchParams.set('test', '1');
    await page.goto(url.href);
    await page.locator('#title').waitFor();
  };

  await goto(false);
  await shot('01-title');
  await click('collection');
  assert.equal(await page.locator('#material-cards button:enabled').count(), 0);
  assert(await page.locator('#book-confirm').isDisabled());
  await click('book-back');
  await click('adventure');
  assert.equal(await page.locator('#hero-cards button').count(), 5);
  await choose('roller');
  await shot('02-roller');
  await click('hero-confirm');
  assert.equal(await page.locator('#stage-cards button:enabled').count(), 1);
  await shot('03-stage');
  await openStage(1);
  const cdp = await context.newCDPSession(page);
  const box = await page.locator('#scene').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{x: box.x + 345 * box.width / 720, y: box.y + 629 * box.height / 1280}]
  });
  try {
    await page.waitForFunction(() => Number(document.querySelector('#kills').textContent) > 0, null, { timeout: 6000 });
  } catch (error) {
    console.error(errors, 'Clock:', await page.locator('#clock').textContent());
    await shot('debug-battle');
    throw error;
  }
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await shot('04-roller-battle');
  await click('pause');
  const seconds = await page.locator('#clock').textContent();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#clock').textContent(), seconds);
  await shot('05-settings');
  await click('leave');

  await goto(true);
  await click('adventure');
  await choose('slasher');
  await click('hero-confirm');
  await openStage(1);
  await page.evaluate(() => {
    const {G,step}=StudioTest;
    for(let i=0;i<4700&&G.state==='play';i++)step(1/60);
  });
  assert.equal(await page.locator('#r-title').textContent(),'TIME UP');
  await click('result-back');
  assert.equal(await page.locator('#stage-cards button:enabled').count(),1);
  await openStage(1);

  const clears = [];
  for (const [n, hero, material] of [[1,'slasher','wax'],[2,'spinner','jelly'],[3,'roller','soap']]) {
    if (n > 1) {
      await click('result-back');
      await click('stage-back');
      await choose(hero);
      await click('hero-confirm');
      await openStage(n);
    }
    const opening = await page.evaluate(() => StudioTest.targets().map(b => b.material));
    assert.equal(new Set(opening).size, 1);
    assert.equal(opening[0], material);
    const result = await page.evaluate(async n => {
      const {G,input,step,targets}=StudioTest;
      const advance=secs=>{for(let i=0;i<Math.ceil(secs*60)&&G.state==='play';i++){
        if(G.choice)return;
        step(1/60);
      }};
      const tap=p=>{input.down(p);advance(.047);input.up(p);};
      let sawGale=false, lastUp=null, nextAction=0, aim=null, spinner=false, rollerTarget=null;
      let bossShot=false, upgradeShot=false;
      const handleLevel=()=>{
        if(!G.choice)return;
        lastUp=G.t;
        const gale=G.choice.findIndex(c=>c.id==='gale');
        sawGale ||= gale>=0;
        const heavy=G.choice.findIndex(c=>c.id==='heavy');
        document.querySelectorAll('.upcard')[Math.max(0,gale,heavy)].click();
        aim=null;rollerTarget=null;nextAction=0;
      };
      for(let frame=0;frame<5200&&G.state==='play';frame++){
        if(window.studioShot && G.choice && !upgradeShot){
          upgradeShot=true;
          StudioTest.draw();
          await window.studioShot('stage-'+n+'-upgrade');
        }
        handleLevel();
        if(window.studioShot && G.boss && !bossShot){
          bossShot=true;
          StudioTest.draw();
          await window.studioShot('stage-'+n+'-boss');
        }
        if(G.bossDown){step(1/60);continue;}
        const pool=targets().filter(b=>b.y>180&&b.y<1130);
        const target=pool.find(b=>b.bossPart)||pool.filter(b=>!b.bossPart).sort((a,b)=>b.y-a.y)[0];
        if(G.cls==='roller'){
          if(target && (!rollerTarget||rollerTarget.id!==target.id||!input.ptr)){
            input.up();input.down(target);rollerTarget=target;
          }
          if(target&&input.ptr) input.move({x:target.x,y:target.y});
        }else if(G.cls==='spinner'){
          if(target&&!aim){
            aim={x:target.x,y:target.y,at:G.rt};spinner=true;
            input.down({x:aim.x+64,y:aim.y});
          }
          if(aim){
            const elapsed=G.rt-aim.at, a=elapsed*11;
            input.move({x:aim.x+Math.cos(a)*64,y:aim.y+Math.sin(a)*64});
            if(elapsed>.87){input.up();aim=null;}
          }
        }else if(target && G.rt>=nextAction){
          tap({x:target.x,y:target.y});
          nextAction=G.rt+.235;
        }
        if(G.cls==='spinner'&&!target&&aim){input.up();aim=null;}
        step(1/60);
      }
      return { hero:G.cls, clear:G.stats.bossDefeated, kills:G.stats.kills, lvl:G.hero.ups.size+1,
        bossHits:G.stats.bossHits, cuts:G.stats.cutErrors||0, upgrades:G.stats.ups, sawGale, lastUp, spinner,
        remaining:StudioTest.world.bodies.filter(b=>b.bossPart&&!b.removed&&!b.active).map(b=>[b.bossLayer,b.hp]), time:G.t };
    }, n);
    console.log('STAGE '+n, result);
    assert(result.clear, JSON.stringify(result));
    assert.equal(result.cuts, 0, `Stage ${n}: a cut fell back to particles`);
    assert.equal(result.hero, hero);
    if (hero==='spinner') assert(result.sawGale && result.upgrades.includes('gale'));
    clears.push(result);
    await shot('stage-'+n+'-result');
  }

  await click('result-title');
  await click('collection');
  assert.equal(await page.locator('#material-cards button:enabled').count(), 3);
  await shot('09-book');
  for (const [layout,count,hero] of [['single',1,'crusher'],['group',6,'caster'],['supply',6,'roller']]) {
    await page.locator('label').filter({has:page.locator('input[value="'+layout+'"]')}).tap();
    await page.locator('#material-cards [data-stage="3"]').tap();
    await click('book-confirm');
    await choose(hero);
    await click('hero-confirm');
    const data = await page.evaluate(() => ({free:StudioTest.G.free, cls:StudioTest.G.cls,
      materials:StudioTest.targets().map(b=>b.material)}));
    assert.deepEqual(data,{free:layout,cls:hero,materials:Array(count).fill('soap')});
    assert(await page.locator('#breach-box').isHidden());
    assert(await page.locator('#upmeter').isHidden());
    await page.evaluate(() => {
      const {G,step,targets,world,input}=StudioTest;
      if(G.cls!=='roller'){
        for(let i=0;i<6&&targets().length;i++){
          const target=targets()[0];
          input.down({x:target.x,y:target.y});
          for(let f=0;f<5;f++)step(1/60);
          input.up();
          for(let f=0;f<19;f++)step(1/60);
        }
        if(G.stats.kills===0)throw new Error(G.cls+' did not break a material');
      }
      if(G.free==='supply'){
        for(const body of targets())world.shatter(body,600,{action:0});
      }
      for(let i=0;i<3720;i++)step(1/60);
    });
    assert.equal(await page.evaluate(() => StudioTest.G.state),'play');
    assert.equal(await page.evaluate(() => StudioTest.G.stats.breaches.length),0);
    if (layout==='supply') assert.equal(await page.evaluate(() => StudioTest.targets().length),6);
    await click('free-refill');
    assert.equal(await page.evaluate(() => StudioTest.targets().length),count);
    await click('pause');
    await click('leave');
  }
  await goto(false);
  await click('collection');
  assert.equal(await page.locator('#material-cards button:enabled').count(), 3);
  assert.deepEqual(errors, []);
  console.log('3 clears, material persistence, 5 heroes and free-play layouts passed');

  const compact = await browser.newPage({viewport:{width:320,height:568}});
  await compact.goto(base);
  await compact.locator('#title').waitFor();
  assert.equal(await compact.evaluate(() => document.documentElement.scrollWidth),320);
  const compactErrors = await compact.locator('#error').isVisible();
  assert(!compactErrors);
} finally { await browser.close(); }
