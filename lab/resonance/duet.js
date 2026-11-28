import {makeStudio} from './chamber.js'
import {glass} from './glass.js'
const $=id=>document.getElementById(id),pad=$('pad'),g=pad.getContext('2d')
const tau=Math.PI*2, clamp=v=>Math.max(0,Math.min(1,v))
const colors=['#83ddce','#f6cb92','#bdaaff','#e8b4d1','#96dcff']
const gems=Array.from({length:32},(_,i)=>{
  const ring=Math.floor(i/8),theta=(i%8+ring*.46)*tau/8
  return {r:.085+ring*.098,theta,k:(i+ring)%5,when:-1e5,cx:0,cy:0}
})
let ctx,studio,glassBus,muted=false,W,H,side,pointer=null,point,held=false,roller=false
let bow,record=[],take=[],duration=0,replay=false,cursor=0,start,lastFrame,depth,pressure=0,speed=0
let total=0,count=0,dir=1,turn=0,step=0,timer,lastNote=0
const level=()=>1+Number(total>=12)+Number(total>=32)
function sound(){
  if(!ctx){
    ctx=new AudioContext();studio=makeStudio(ctx);studio.space(true)
    glassBus=ctx.createGain();glassBus.connect(studio.master)
    for(const [seconds,position,volume] of [[.113,-.58,.17],[.213,.62,.13],[.347,-.32,.085],[.521,.35,.048]]){
      const delay=ctx.createDelay(1),pan=ctx.createStereoPanner(),amp=ctx.createGain()
      delay.delayTime.value=seconds;pan.pan.value=position;amp.gain.value=volume
      glassBus.connect(delay).connect(amp).connect(pan).connect(studio.master)
    }
    studio.master.gain.value=muted?0:.65
  }
  if(ctx.state!=='running')ctx.resume().catch(()=>{})
}
function coords(o){return {x:.5+Math.cos(o.theta)*o.r*side/W,y:.47+Math.sin(o.theta)*o.r*side/H}}
function hit(){
  const now=performance.now(), range=(80+Math.min(70,step*7))*side/320
  let chosen, distance=Infinity
  for(const o of gems){const q=coords(o),d=Math.hypot((q.x-point.x)*W,(q.y-point.y)*H)
    if(now-o.when>1600&&d<range&&d<distance){chosen=o;distance=d}}
  step++
  if(!chosen)return
  chosen.when=now;chosen.cx=point.x;chosen.cy=point.y
  const band=Math.min(3,Math.floor(distance/(side*.105)))
  const degree=dir>0?count%5:4-count%5
  const n=band+degree,k=chosen.k,t=ctx.currentTime
  studio.strike(k,n,point.x,t+.06,.96,true)
  if(level()>=2&&count%3===0)studio.strike((k+2)%5,n+2,1-point.x,t+.10,.38,true)
  if(level()===3&&count%4===0)studio.strike(4,Math.min(9,n+4),.5,t+.18,.25,true)
  lastNote=n;count++;total++;status()
}
function status(){
  $('status').textContent=roller?(replay?'軌跡を再演中':held?'圧縮 '+Math.round(depth*100)+'%':'左から右へ　低音 → 高音'):
    'Lv.'+level()+'　'+['','単音','彩り','和音'][level()]+'　'+(dir>0?'↻':'↺')+'　解放 '+total
}
function setPoint(p,dt){
  const dx=(p.x-point.x)*W,dy=(p.y-point.y)*H
  if(!roller){
    const ax=(point.x-.5)*W,ay=(point.y-.47)*H
    if(Math.hypot(ax,ay)>side*.045){
      turn+=Math.atan2(ax*dy-ay*dx,ax*(ax+dx)+ay*(ay+dy))
      if(Math.abs(turn)>.15){dir=Math.sign(turn);turn=0}
    }
  }
  speed=Math.min(1,Math.hypot(dx,dy)/side/Math.max(.012,dt)*1.7)
  point=p;pressure=p.force
}
function finish(save,cadence){
  if(!held)return
  if(roller){
    bow.stop();bow=null
    if(save&&!replay){take=record;duration=performance.now()-start;$('again').disabled=!take.length}
  }else{
    clearInterval(timer)
    if(cadence&&count>=6){
      const root=lastNote%5
      ;[0,2,4].forEach((d,i)=>studio.strike(4,root+d,.25+i*.25,ctx.currentTime+.08+i*.14,.43/(1+i*.35),true))
    }
  }
  held=false;replay=false;pointer=null;status()
}
function begin(p){
  sound();point=p;pressure=p.force;held=true;depth=.04;speed=0
  start=performance.now();lastMove=0;lastFrame=start;count=0;step=0;turn=0;dir=1
  if(roller)bow=glass(ctx,glassBus,p.x,p.y,$('mode').selectedIndex)
  else{hit();timer=setInterval(hit,85)}
  status()
}
function pos(e){const b=pad.getBoundingClientRect();return {x:clamp((e.clientX-b.left)/b.width),y:clamp((e.clientY-b.top)/b.height),force:e.pressure===.5?0:e.pressure}}
function change(){
  finish(false,false);roller=$('hero').selectedIndex===1
  $('title').textContent=roller?'テルミンとグラスハープ':'音の万華鏡'
  $('guide').textContent=roller?'横に滑らせて音程を、縦に渡って素材を変える。指を留めると深く響きます。':'結晶のそばを長押し。庭の中心を時計回り・反時計回りになぞると旋律が反転します。'
  $('modeLabel').hidden=$('again').hidden=!roller;status()
}
$('hero').onchange=change
$('mode').onchange=()=>finish(false,false)
$('mute').onclick=()=>{muted=!muted;sound();studio.master.gain.setTargetAtTime(muted?0:.65,ctx.currentTime,.025);$('mute').textContent=muted?'音 OFF':'音 ON';$('mute').setAttribute('aria-pressed',String(muted))}
pad.onpointerdown=e=>{if(held&&!replay)return;finish(false,false);pointer=e.pointerId;pad.setPointerCapture(pointer);const p=pos(e);record=[{...p,t:0}];begin(p)}
let lastMove=0
pad.onpointermove=e=>{if(e.pointerId!==pointer||!held)return;const p=pos(e),t=performance.now()-start
  setPoint(p,(t-lastMove)/1000);lastMove=t
  if(roller){record.push({...p,t});if(record.length>6000)record=record.filter((_,i)=>i%2===0||i===record.length-1)}
}
pad.onpointerup=e=>{if(e.pointerId===pointer)finish(true,true)}
pad.onlostpointercapture=pad.onpointercancel=e=>{if(e.pointerId===pointer)finish(false,false)}
$('again').onclick=()=>{finish(false,false);if(take.length){cursor=1;replay=true;begin(take[0])}}
document.addEventListener('visibilitychange',()=>{if(document.hidden){finish(false,false);ctx?.suspend()}})
function circle(x,y,r,fill){g.beginPath();g.arc(x,y,r,0,tau);if(fill)g.fill();else g.stroke()}
function frame(t){
  g.clearRect(0,0,W,H)
  if(roller){
    if(held){
      if(replay){while(cursor<take.length&&take[cursor].t<=t-start){setPoint(take[cursor],(take[cursor].t-take[cursor-1].t)/1000);cursor++}}
      const dt=Math.max(0,Math.min(.1,(t-lastFrame)/1000))
      speed*=Math.exp(-dt*5);depth+=(Math.max(pressure,1-speed)-depth)*(1-Math.exp(-dt*1.5))
      bow.move(point.x,point.y,depth,$('mode').selectedIndex);lastFrame=t
      if(replay&&t-start>=duration)finish(false,false);else status()
    }
    for(let i=0;i<=24;i++){g.strokeStyle=i%3?'#718c9833':'#94c8c855';g.beginPath();g.moveTo(i*W/24,0);g.lineTo(i*W/24,H);g.stroke()}
    ;['水晶','水滴','グラス'].forEach((label,i)=>{
      const y=(.12+i*.36)*H;g.strokeStyle=colors[i];g.globalAlpha=.6
      for(let j=0;j<3;j++){g.beginPath();for(let x=0;x<=W;x+=2){const wave=y+(5+j*2)*(held?1+depth:1)*Math.sin(x/45+j*.7+(held?t*.002:0));if(x)g.lineTo(x,wave);else g.moveTo(x,wave)}g.stroke()}
      g.globalAlpha=1;g.fillStyle='#e2eee8';g.fillText(label,12,y-12)
    })
    if(held){g.strokeStyle='#faf9d9';circle(point.x*W,point.y*H,12+depth*13,false)}
  }else{
    for(let i=0;i<4;i++){g.strokeStyle='#a2d3cc30';circle(.5*W,.47*H,(.085+i*.098)*side,false)}
    for(const o of gems){
      const q=coords(o),age=t-o.when,travel=clamp(age/140)
      if(age>210&&age<1500)continue
      const pull=age<210?travel:0,x=(q.x+(o.cx-q.x)*pull)*W,y=(q.y+(o.cy-q.y)*pull)*H
      g.save();g.translate(x,y);g.rotate(o.theta+(age<210?dir*travel*2:0))
      g.fillStyle=colors[o.k];g.globalAlpha=age<210?1-travel*.7:1;g.beginPath();g.moveTo(0,-9);g.lineTo(6,0);g.lineTo(0,9);g.lineTo(-6,0);g.closePath();g.fill();g.restore()
    }
    if(held){g.strokeStyle='#a4f2dd';g.beginPath();g.arc(point.x*W,point.y*H,20,dir*t*.006,dir*t*.006+4.7);g.stroke()}
  }
  requestAnimationFrame(frame)
}
function resize(){const b=pad.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);W=b.width;H=b.height;side=Math.min(W,H);pad.width=W*d;pad.height=H*d;g.setTransform(d,0,0,d,0,0)}
new ResizeObserver(resize).observe(pad);resize();change();requestAnimationFrame(frame)
