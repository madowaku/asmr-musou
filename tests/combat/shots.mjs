import {chromium} from 'playwright';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.argv[2]||path.join(root,'research/v04/shots');await mkdir(out,{recursive:true});
const cls=process.argv[3]||'slasher',skill=process.argv[4]||'skilled',times=(process.argv[5]||'2,6,12,20,30,38,46,54').split(',').map(Number);
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:432,height:768},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.clock.install();await page.goto(pathToFileURL(path.join(root,'combat.html')).href);await page.clock.runFor(500);await page.waitForFunction(()=>window.COMBAT);
await page.evaluate(([c,k])=>COMBAT.test.play(c,1,k),[cls,skill]);let t=0;
for(const tt of times){await page.clock.runFor((tt-t)*1000);t=tt;await page.screenshot({path:`${out}/${cls}_${String(tt).padStart(2,'0')}.png`});}
const st=await page.evaluate(()=>({t:COMBAT.state.t,state:COMBAT.state.state,stats:COMBAT.state.stats,boss:!!COMBAT.state.boss}));console.log(JSON.stringify({cls,skill,...st,stats:{...st.stats,perAction:undefined}}));
await browser.close();if(errors.length)console.error(errors.slice(0,5));
