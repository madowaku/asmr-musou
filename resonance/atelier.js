import {instrument,pitches} from './voice.js'
const el=id=>document.getElementById(id), canvas=document.querySelector('canvas'), g=canvas.getContext('2d')
const colors=['#95e4ff','#75dfcc','#ffcd89','#f2aace','#eac58d']
const stages=['単音','和音','余韻','合奏'], layers=['外殻 · 水晶ベル','内層 · 音花と水滴','共鳴核 · 深鐘']
let width,height,ctx,voice,muted=false,objects=[],path=[],effects=[],pointer=null,previous
let released=0,boss=false,beat=0,ready=0,epoch=0
const level=()=>1+[6,16,30].filter(n=>released>=n).length
function resize(){width=canvas.clientWidth;height=canvas.clientHeight;const d=Math.min(devicePixelRatio,2);canvas.width=width*d;canvas.height=height*d;g.setTransform(d,0,0,d,0,0)}
new ResizeObserver(resize).observe(canvas)
function createField(){
  objects=Array.from({length:boss?6:20},(_,i)=>{
    const angle=i*Math.PI/3-Math.PI/2
    const x=boss?.5+.25*Math.cos(angle):.14+(i%4)*.24+.022*Math.sin(i*5)
    const y=boss?.48+.23*Math.sin(angle):.12+Math.floor(i/4)*.18+.025*Math.sin(i*2)
    const kind=boss?[0,i%2?1:3,4][Math.min(2,Math.floor(beat/3))]:(i+Math.floor(i/4))%4
    return {x,y,kind,pitch:(i%4+Math.floor((1-y)*4))%8,available:0}
  })
}
function ui(){
  el('level').textContent='Lv.'+level()+'　'+stages[level()-1]
  el('status').textContent=boss?(beat===9?'共鳴核を解放しました':layers[Math.floor(beat/3)]+'　'+(beat%3+1)+'/3　·　リンク '+path.length):('リンク '+path.length+'　·　解放 '+released)
}
function unlock(){if(!ctx){ctx=new AudioContext();voice=instrument(ctx);voice.master.gain.value=muted?0:.62}if(ctx.state==='suspended')ctx.resume().catch(()=>{})}
function play(k,p,delay=0,w=1,len=1){if(!muted&&ctx)voice.note(k,p,ctx.currentTime+delay,w,len)}
el('sound').onclick=()=>{muted=!muted;unlock();voice.master.gain.setTargetAtTime(muted?0:.62,ctx.currentTime,.02);el('sound').textContent=muted?'音 OFF':'音 ON';el('sound').setAttribute('aria-pressed',String(!muted))}
el('mode').onclick=()=>{epoch++;boss=!boss;beat=0;ready=0;pointer=null;path=[];effects=[];createField();ui();el('mode').textContent=boss?'庭に戻る ↗':'巨大オルゴールへ ↗';el('guide').textContent=boss?'光る結晶をつないで離す。余韻のあと、次の層へ。':'ひとつ触れて離す。次は、いくつかつないで離す。'}
function pos(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
function trace(a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1], now=performance.now()
  const hits=[]
  for(const o of objects){
    if(o.available>now||path.includes(o))continue
    const x=o.x*width-a[0],y=o.y*height-a[1], t=Math.max(0,Math.min(1,(x*dx+y*dy)/(dx*dx+dy*dy||1)))
    if(Math.hypot(x-t*dx,y-t*dy)<Math.min(width*.112,level()===4?46:33))hits.push({o,t})
  }
  hits.sort((u,v)=>u.t-v.t).forEach(({o},i)=>{path.push(o);play(o.kind,pitches[o.pitch],i*.025,.23,.44)})
  ui()
}
canvas.onpointerdown=e=>{if(pointer!==null||performance.now()<ready||boss&&beat===9)return;unlock();canvas.setPointerCapture(e.pointerId);pointer=e.pointerId;previous=pos(e);trace(previous,previous)}
canvas.onpointermove=e=>{if(pointer!==e.pointerId)return;const p=pos(e);trace(previous,p);previous=p}
canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(pointer===e.pointerId){pointer=null;path=[];ui()}}
function burst(o,lv,n){
  const hz=pitches[o.pitch]*(o.kind===4?.5:1)
  play(o.kind,hz)
  if(o.kind===2||o.kind===3||lv>=3){play(o.kind,pitches[(o.pitch+2)%8],.145,.35,.72);play(o.kind,pitches[(o.pitch+4)%8],.29,.22,.6)}
  if(o.kind===1)play(1,hz*2,.085,.21,.42)
  effects.push({o,time:performance.now(),n})
}
canvas.onpointerup=e=>{
  if(pointer!==e.pointerId)return
  trace(previous,pos(e));pointer=null
  const chain=path;path=[];if(!chain.length)return
  const now=performance.now(),version=epoch,lv=level(),gap=Math.min(145,1400/chain.length)
  const later=(fn,ms)=>setTimeout(()=>{if(version===epoch)fn()},ms)
  chain.forEach((o,i)=>{o.available=Infinity;o.due=now+i*gap;later(()=>{o.available=boss?Infinity:performance.now()+1050;o.due=0;burst(o,lv,i);released++;ui()},i*gap)})
  later(()=>{if(chain.length>=3||lv>=2||boss){[261.63,392,523.25].forEach((hz,i)=>play(boss?4:3,hz,i*.045,.33,1.15))}},(chain.length-1)*gap+110)
  if(boss){ready=now+1750;later(()=>{beat++;createField();if(beat===9){objects=[];play(4,130.815,0,1,1.6);el('guide').textContent='余韻が消えるまで、ひと休み。庭から再演できます。'}ui()},1750)}
  ui()
}
function polygon(points){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke()}
function circle(x,y,r){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke()}
function jewel(o,r,t){
  const k=o.kind, c=colors[k];g.strokeStyle=c;g.lineWidth=1.4
  const glow=g.createRadialGradient(-r*.25,-r*.4,1,0,0,r*1.3);glow.addColorStop(0,'#f4ffea');glow.addColorStop(.26,c);glow.addColorStop(1,'#273649');g.fillStyle=glow
  if(k===3){for(let i=0;i<6;i++){g.rotate(Math.PI/3);g.beginPath();g.ellipse(0,-r*.53,r*.38,r*.61,0,0,7);g.fill();g.stroke()}circle(0,0,r*.24)}
  else if(k===1){g.beginPath();g.arc(0,0,r,0,7);g.fill();g.stroke();g.beginPath();g.arc(-2,-2,r*.68,3.5,4.9);g.stroke()}
  else if(k===2){polygon([[-r,-r*.56],[r*.58,-r],[r,r*.59],[-r*.55,r]]);for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*r*.4-2,-r*.45);g.lineTo(i*r*.4+2,r*(.47-i*.1));g.stroke()}}
  else{polygon([[0,-r*1.3],[r,0],[0,r*1.3],[-r,0]]);polygon([[0,-r*1.3],[r*.35,0],[0,r*1.3],[-r*.36,0]])}
}
function frame(t){
  g.clearRect(0,0,width,height)
  g.strokeStyle='#91cbd51c';g.lineWidth=1
  for(let i=1;i<=5;i++)circle(width*.5,height*.48,i*width*.115)
  if(boss&&beat<9){g.save();g.translate(width*.5,height*.48);g.rotate(t*.00014);jewel({kind:[0,3,4][Math.floor(beat/3)]},width*.1,t);g.restore()}
  if(path.length){g.strokeStyle='#d4fff2';g.lineWidth=2;g.beginPath();path.forEach((o,i)=>i?g.lineTo(o.x*width,o.y*height):g.moveTo(o.x*width,o.y*height));if(previous)g.lineTo(...previous);g.stroke()}
  for(const [i,o] of objects.entries()){
    if(o.available>t&&!(o.due>t))continue
    const linked=path.includes(o);g.save();g.translate(o.x*width+(linked?Math.sin(t*.038)*1.7:0),o.y*height+2*Math.sin(t*.0017+i))
    const r=Math.min(width*.049,height*.052,24)*(1+.1*Math.sin(i))
    if(linked||o.due>t){g.strokeStyle='#e9fff4';circle(0,0,r+6)}
    jewel(o,r,t);g.restore()
  }
  // The resonator bows a tuning fork toward the current chain.
  g.save();g.translate(width*.5,height*.925);const s=Math.min(1,height/530);g.scale(s,s)
  g.strokeStyle='#e9cf9e';g.fillStyle='#609497';g.lineWidth=1.5
  polygon([[-5,-8],[4,-8],[11,8],[0,5],[-11,8]])
  g.fillStyle='#ffe4c4';g.beginPath();g.arc(0,-13,5.5,0,7);g.fill()
  g.translate(9,-4);g.rotate(path.length?-.45:.18);g.beginPath();g.moveTo(0,7);g.lineTo(0,-5);g.moveTo(-3,-12);g.lineTo(-3,-6);g.quadraticCurveTo(0,-2,3,-6);g.lineTo(3,-12);g.stroke();g.restore()
  effects=effects.filter(f=>t-f.time<1000)
  for(const {o,time,n} of effects){const a=Math.max(0,(t-time)/1000);g.save();g.translate(o.x*width,o.y*height);g.globalAlpha=1-a;g.strokeStyle=colors[o.kind];circle(0,0,8+42*a);for(let j=0;j<6;j++){const angle=j*Math.PI/3+n;g.fillStyle=colors[o.kind];g.fillRect(Math.cos(angle)*42*a,Math.sin(angle)*40*a+28*a*a,3,4)}g.restore()}
  requestAnimationFrame(frame)
}
resize();createField();ui();requestAnimationFrame(frame)


