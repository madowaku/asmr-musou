// SPINNER gesture recognition through the real input path (P.down/move/up at 60 Hz game steps).
// Circles of different size / speed / direction / sloppiness must spin; arcs, swipes, zigzags, taps, holds must not.
// For each gesture: did it spin, after how long, how many slice ticks (per turn), what happened instead.
import {chromium} from 'playwright';import {pathToFileURL,fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(pathToFileURL(path.join(root,'flow.html')).href);await page.waitForFunction(()=>window.CRUNCH);
const G=[ // name, expect, points generator spec
  ['小さな円・ゆっくり（半径45、1.5周を2秒）','spin',{kind:'circle',R:45,turns:1.5,secs:2}],
  ['小さな円・速い（半径45、3周を1秒）','spin',{kind:'circle',R:45,turns:3,secs:1}],
  ['大きな円・ゆっくり（半径150、1.25周を2秒）','spin',{kind:'circle',R:150,turns:1.25,secs:2}],
  ['大きな円・速い（半径150、3周を1.2秒）','spin',{kind:'circle',R:150,turns:3,secs:1.2}],
  ['逆回り（半径90、1.5周を1秒）','spin',{kind:'circle',R:90,turns:-1.5,secs:1}],
  ['いびつな楕円（120×60、揺れあり、1.5周）','spin',{kind:'ellipse',R:120,Ry:60,turns:1.5,secs:1.3,noise:12}],
  ['とてもゆっくり（半径70、1周を3秒）','spin',{kind:'circle',R:70,turns:1.2,secs:3.6}],
  ['半円の弧（150°）','no',{kind:'circle',R:120,turns:150/360,secs:.4}],
  ['まっすぐスワイプ（300px）','no',{kind:'line',len:300,secs:.2}],
  ['ジグザグ（4往復）','no',{kind:'zigzag',secs:.6}],
  ['タップ','no',{kind:'tap'}],
  ['長押し→離す（0.7秒）','no',{kind:'hold',secs:.7}],
  ['8の字','?',{kind:'eight',R:80,secs:1.6}],
];
const out=[];
for(const [name,expect,spec] of G){const r=await page.evaluate(spec=>{const C=LAB.combat,W=LAB.world,S=CRUNCH.state,P=CRUNCH.test.input;S.headless=true;S.pickPolicy=ch=>ch[0];CRUNCH.test.play('spinner',3,null);W.bodies.length=0;S.sched.spawn=999;S.sched.hard=999;
    const c={x:360,y:620};let ticks=0,firstT=null,hits=0;const ot=C.spinTick;C.spinTick=(h,cc,rr,o)=>{ticks++;if(firstT==null)firstT=S.rt;const n=ot(h,cc,rr,o);hits+=n;return n;};
    for(let i=0;i<6;i++){const e=C.crunch.spawn('weak',c.x+Math.cos(i)*110,c.y+Math.sin(i)*110,{m:'jelly'});e.speed=0;e.base=0;}
    const pts=[];const N=Math.max(2,Math.round((spec.secs||.05)*60));
    if(spec.kind==='circle'||spec.kind==='ellipse'){for(let i=0;i<=N;i++){const a=i/N*spec.turns*6.283,n=spec.noise?Math.sin(i*1.7)*spec.noise:0;pts.push({x:c.x+Math.cos(a)*(spec.R+n),y:c.y+Math.sin(a)*((spec.Ry||spec.R)+n)});}}
    else if(spec.kind==='line'){for(let i=0;i<=N;i++)pts.push({x:c.x-150+spec.len*i/N,y:c.y+i/N*30});}
    else if(spec.kind==='zigzag'){for(let i=0;i<=N;i++){const t=i/N;pts.push({x:c.x-150+300*t,y:c.y+((Math.floor(t*8)%2)?(t*8%1):1-(t*8%1))*90});}}
    else if(spec.kind==='eight'){for(let i=0;i<=N;i++){const a=i/N*6.283;pts.push({x:c.x+Math.sin(a)*spec.R*1.4,y:c.y+Math.sin(2*a)*spec.R*.7});}}
    else if(spec.kind==='tap'){pts.push(c,c);}else if(spec.kind==='hold'){for(let i=0;i<=N;i++)pts.push(c);}
    const t0=S.rt;P.down(pts[0]);let spun=false;for(let i=1;i<pts.length;i++){CRUNCH.test.step(1/60);P.move(pts[i]);if(P.ptr&&P.ptr.spinning)spun=true;}
    const holding=!!(P.ptr&&P.ptr.charging);P.up(pts[pts.length-1]);for(let i=0;i<50;i++)CRUNCH.test.step(1/60);C.spinTick=ot;
    const turns=Math.abs(spec.turns||0);return {spun,recognisedAfter:firstT!=null&&spun?+(firstT-t0).toFixed(2):null,ticks,perTurn:turns&&spun?+(ticks/turns).toFixed(1):null,hits,charged:holding,actions:S.stats.actions,kills:S.stats.kills,hurts:S.stats.hurts};},spec);
  const ok=expect==='?'?'—':(expect==='spin')===r.spun?'OK':'NG';out.push({name,expect,...r,ok});
  console.log(`${ok.padEnd(3)} ${name.padEnd(26)} 回転=${r.spun?'はい':'いいえ'} 認識${r.recognisedAfter??'-'}秒 刻み${r.ticks}（1周あたり${r.perTurn??'-'}） 当たり${r.hits} 撃破${r.kills} 削り${r.hurts}${r.charged?' 溜め':''}`);}
await writeFile(path.join(root,'research/v08/spin.json'),JSON.stringify(out,null,1));await browser.close();if(errors.length){console.error(errors);process.exit(1);}
