import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.STUDIO_PREVIEW_URL || new URL('../../studio.html', import.meta.url).href;
const browser = await chromium.launch({channel: 'chrome'});
try {
  for (const [width,height] of [[360,640],[390,844]]) {
    const page = await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.locator('#language').tap();
    await page.waitForSelector('html[lang=en] #title:not([hidden])');
    await page.locator('#settings-open').tap();
    await page.locator('#volume').fill('37');
    await page.locator('#settings-close').tap();
    await page.goto(base);
    await page.locator('#title').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.locator('#volume').inputValue(),'37');
    assert.equal(await page.locator('#sound-mode').isVisible(),false);
    assert.deepEqual(await page.evaluate(()=>[StudioSound.mode,LAB.combat.rollerFeel.refined]),['A',true]);
    await page.locator('#adventure').tap();
    await page.locator('[data-hero="crusher"]').last().tap();
    assert.equal(await page.locator('#hero-instruction').textContent(),'Tap the material');
    await page.locator('#hero-confirm').tap();
    await page.locator('#stage-cards button').first().tap();
    const box = await page.locator('#scene').boundingBox();
    await page.touchscreen.tap(box.x+box.width*345/720,box.y+box.height*613/1280);
    await page.waitForFunction(()=>Number(document.querySelector('#kills').textContent)>0);
    await page.locator('#pause').tap();
    await page.locator('#leave').tap();
    const testURL = new URL(base);
    testURL.searchParams.set('test','1');
    await page.goto(testURL.href);
    await page.locator('#adventure').tap();
    await page.locator('#hero-confirm').tap();
    await page.locator('#stage-cards button').first().tap();
    await page.evaluate(()=>{for(let i=0;i<5000 && StudioTest.G.state==='play';i++) StudioTest.step(1/60);});
    await page.locator('#result').waitFor();
    assert(!/[ぁ-龯]/u.test(await page.locator('#result').innerText()));
    await page.locator('#again').tap();
    await page.locator('#hud').waitFor();
    assert.equal(await page.evaluate(()=>StudioTest.G.t),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(width,height,'English, persistence, first touch and retry passed');
  }
} finally {await browser.close();}
