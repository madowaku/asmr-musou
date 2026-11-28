import {orchestraSound,scaleHz} from './orchestra-sound.js'
import {glass,pitch} from './glass.js'
const $=id=>document.getElementById(id),pad=$('pad'),g=pad.getContext('2d'),tau=2*Math.PI
const palette=['#a1edf5','#e7c68e','#bd916f','#d0baff','#a1dbc7','#b7c8f7']
const guides=['結晶をつないで離すと、指の順にベルが響きます。','弦を横切って一振り。指を離すと、ハープが流れます。','素材をタップ。マリンバの音が近くの素材へ跳ねます。','光をなぞって集め、輪を描いて離すとパイプの和音になります。','長押しで吸い込み。庭の中心を回り、向きを返すと旋律も折り返します。','横は音程、縦は素材。ゆっくり押し込んでから離すと和音が残ります。']
const stageNames=['外殻','内層','共鳴核']
let scene=0,hero=0,ctx,audio,muted=false,nodes=[],w,h,side,hand=null,total=0,spinTotal=0
let last=0,flipped=-1e5,dir=1,revision=0
const loops=new Map(), timers=new Set(),loopBows=new Map()
const clamp=v=>Math.max(0,Math.min(1,v)), now=()=>performance.now()
function wake(){if(!ctx){ctx=new AudioContext();audio=orchestraSound(ctx);volume()}if(ctx.state!=='running')ctx.resume().catch(()=>{})}
function volume(){if(audio)audio.master.gain.setTargetAtTime(muted?0:scene===4?.31:.62,ctx.currentTime,.03)}
$('mute').onclick=()=>{muted=!muted;wake();volume();$('mute').textContent=muted?'音 OFF':'音 ON';$('mute').setAttribute('aria-pressed',String(muted))}
function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id)}
function clearBand(){loops.clear();for(const t of timers)clearTimeout(t);timers.clear();for(const b of loopBows.values())b.stop();loopBows.clear()}
function field(){
 const amount=[32,96,36,32,22][scene]
 nodes=Array.from({length:amount},(_,i)=>{
   const ring=scene===2?2-Math.floor(i/12):Math.floor(i/8),a=(i%(scene===2?12:8)+(ring%2)*.45)*tau/(scene===2?12:8)
   const r=scene===2?.105+ring*.145:scene===1?.049+.036*ring:.095+.098*ring
   return {x:.5+Math.cos(a)*r*side/w,y:.47+Math.sin(a)*r*side/h,n:i%8,i,used:-1e5,broken:false}
 })
}
function resize(){const r=pad.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);w=r.width;h=r.height;side=Math.min(w,h);pad.width=w*d;pad.height=h*d;g.setTransform(d,0,0,d,0,0);if(!nodes.length)field()}
function setup(){
 end(false);const s=$('scene').selectedIndex
 if(scene!==s){clearBand();total=0;scene=s;field();revision++}
 hero=$('hero').selectedIndex;volume();pad.parentElement.classList.toggle('night',scene===4)
 $('guide').textContent=guides[hero]+(scene===3?'　一節ずつ奏者を替えると重なります。':'')
 $('action').hidden=scene!==2&&scene!==3;$('action').textContent=scene===2?'組み直す':'楽団の音を消す';status()
}
function status(){
 const bonus=hero===4?'　'+(dir>0?'↻ 上行':'↺ 下行')+' Lv.'+(1+Number(spinTotal>=12)+Number(spinTotal>=32)):''
 $('status').textContent=(scene===2?(total===36?'共鳴核を解放':stageNames[Math.floor(total/12)]+'　'+total+'/36'):scene===3?'重なる奏者 '+loops.size+'/6':scene===4?'夜の演奏庭園':'解放 '+total)+bonus
}
function available(o){return scene===2?!o.broken&&Math.floor(o.i/12)===Math.floor(total/12):now()-o.used>1450}
function release(o){if(!available(o))return false;o.used=now();o.broken=true;total++;if(scene===1&&total%12===0){[0,2,4].forEach((d,i)=>audio.note(3,scaleHz(d+(total/12)%3),.25+i*.25,.29,i*.075,1.3))}if(scene===2&&total%12===0){[0,2,4].forEach((n,i)=>audio.note([0,1,3][total/12-1],scaleHz(n-2*(total/12-1)),.3+i*.2,.36,i*.11))}status();return true}
const distance=(a,b)=>Math.hypot((a.x-b.x)*w,(a.y-b.y)*h)/side
function near(p){return nodes.filter(available).sort((a,b)=>distance(a,p)-distance(b,p))}
function capture(e){if(scene===3&&hand&&hand.events.length<800)hand.events.push({...e,t:now()-hand.start+(e.delay||0)*1000})}
function note(n,x,weight=1,delay=0,kind=hero,duration){
 const hz=scaleHz(n);audio.note(kind,hz,x,weight,delay,duration);capture({type:'note',kind,hz,x,weight,delay,duration})
}
function loopPhrase(lane){
 for(const e of lane.events)later(()=>{
   if(loops.get(lane.hero)!==lane)return
   if(e.type==='note')audio.note(e.kind,e.hz,e.x,e.weight*.6,0,e.duration)
   else if(e.type==='start'){loopBows.get(lane.hero)?.stop();loopBows.set(lane.hero,glass(ctx,audio.input,e.x,e.y,2,true))}
   else if(e.type==='move')loopBows.get(lane.hero)?.move(e.x,e.y,e.depth,2)
   else{loopBows.get(lane.hero)?.stop();loopBows.delete(lane.hero)}
 },e.t)
}
function updateBand(t){if(scene!==3)return;for(const lane of loops.values())if(t>=lane.next){loopPhrase(lane);lane.next=t+lane.period}}
function spin(){
 const p=hand;if(!p)return
 const o=near(p).find(v=>distance(v,p)<.25+Math.min(.22,p.count*.023));if(!o||!release(o))return
 const band=Math.min(3,Math.floor(distance(o,p)/.1))
 p.degree=(p.degree+dir+5)%5;const n=band+p.degree
 note(n,p.x,.92,.055)
 if(spinTotal>=12&&p.count%3===0)note(n+2,1-p.x,.36,.135,1)
 if(spinTotal>=32&&p.count%5===0){note(n+4,.33,.27,.18,0);note(n+5,.69,.19,.24,4)}
 spinTotal++;p.count++;p.lastNote=n;o.pull={x:p.x,y:p.y};status()
}
function touch(e){const b=pad.getBoundingClientRect();return {x:clamp((e.clientX-b.left)/w),y:clamp((e.clientY-b.top)/h),force:e.pressure===.5?0:e.pressure}}
function trace(q){
 const p=hand,dx=q.x-p.x,dy=q.y-p.y,dt=Math.max(.012,(now()-p.moved)/1000)
 if(hero===4){
   const ax=(p.x-.5)*w,ay=(p.y-.47)*h
   if(Math.hypot(ax,ay)>.045*side)p.turn+=Math.atan2(ax*dy*h-ay*dx*w,ax*(ax+dx*w)+ay*(ay+dy*h))
   if(Math.abs(p.turn)>.20){const next=Math.sign(p.turn)
     if(next!==dir){dir=next;flipped=now();[0,1,2].forEach((v,i)=>note(Math.max(0,p.lastNote+dir*v),q.x,.48,.048*i));status()}
     p.turn=0
   }
 }
 if([0,1,3].includes(hero)){
   const steps=Math.max(1,Math.ceil(distance(p,q)/.035))
   for(let i=1;i<=steps;i++){const a={x:p.x+dx*i/steps,y:p.y+dy*i/steps}
     for(const o of near(a)){if(distance(a,o)>(hero===1?.085:.065))break
       if(!p.links.includes(o)){p.links.push(o);if(hero!==1)note(o.n,o.x,.17)}
     }
   }
 }
 if(Math.hypot(dx,dy)>.006&&p.path.length<1800)p.path.push(q)
 p.speed=Math.min(1,distance(p,q)/dt*1.6);Object.assign(p,q);p.moved=now()
}
function inside(o,path){let yes=false;for(let i=0,j=path.length-1;i<path.length;j=i++){const a=path[i],b=path[j];if((a.y>o.y)!==(b.y>o.y)&&o.x<(b.x-a.x)*(o.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
function start(e){
 if(hand||scene===2&&total===36)return
 wake();pad.setPointerCapture(e.pointerId);const q=touch(e)
 hand={...q,id:e.pointerId,start:now(),moved:now(),links:[],path:[q],events:[],count:0,degree:4,turn:0,lastNote:3,depth:.025,speed:0,recordAt:0}
 if(hero===4){dir=1;spin();hand.timer=setInterval(spin,85)}
 else if(hero===5){hand.bow=glass(ctx,audio.input,q.x,q.y,2,true);capture({type:'start',...q})}
 else if(hero===2){const root=near(q)[0];if(root&&distance(root,q)<.14)near(root).filter(o=>distance(o,root)<.25).slice(0,scene===1?7:4).forEach((o,i)=>{if(release(o))note(o.n,o.x,1/(1+i*.13),i*.109)})}
 else trace(q)
}
function end(ok){
 const p=hand;if(!p)return;clearInterval(p.timer)
 if(p.bow){p.bow.stop();capture({type:'stop'})}
 if(ok){
   if(hero===4&&p.count>=5){const root=p.lastNote%5;[0,2,4,5].slice(0,p.count>=12?4:3).forEach((d,i)=>note(root+d,.2+.18*i,.43/(1+i*.28),.085+i*.135,5,1.35))}
   if(hero===5){const f=pitch(p.x,2);[1,1.5,2].forEach((ratio,i)=>{const hz=f*ratio,weight=(.25+.13*p.depth)/(1+i*.45);audio.note(5,hz,p.x,weight,i*.035,.72);capture({type:'note',kind:5,hz,x:p.x,weight,delay:i*.035,duration:.72})})}
   if(hero===0||hero===1)p.links.forEach((o,i)=>{if(release(o))note(hero===1?Math.floor(p.links[0].x*4)+8-Math.abs(i%16-8):o.n,o.x,.94,i*Math.min(.093,1.35/p.links.length))})
   if(hero===3){const selected=new Set([...p.links,...nodes.filter(o=>available(o)&&inside(o,p.path))]);const hits=[...selected].filter(release)
     if(hits.length){const root=hits[0].n%5;[0,2,4,5,7].slice(0,Math.min(5,hits.length+2)).forEach((n,i)=>note(root+n,.24+i*.12,.65,.025*i,3))}}
   if(scene===3&&p.events.length){if(hero===5&&!p.events.some(e=>e.type==='stop'))p.events.push({type:'stop',t:now()-p.start})
     loopBows.get(hero)?.stop();loopBows.delete(hero)
     const period=Math.max(2600,now()-p.start+1050,...p.events.map(e=>e.t+650))
     loops.set(hero,{hero,events:p.events,period,next:now()+750})}
 }
 hand=null;status()
}
function frame(t){
 updateBand(t);const dt=Math.min(.08,Math.max(0,(t-last)/1000));last=t;g.clearRect(0,0,w,h)
 if(hand?.bow){const p=hand;p.speed*=Math.exp(-dt*5)
   p.depth+=(Math.max(p.force,1-p.speed)-p.depth)*(1-Math.exp(-dt*1.8))
   p.bow.move(p.x,p.y,p.depth,2)
   if(t-p.recordAt>65){capture({type:'move',x:p.x,y:p.y,depth:p.depth});p.recordAt=t}
   const o=near(p)[0];if(o&&distance(o,p)<.085&&t-(p.crushed||0)>175){release(o);p.crushed=t}
 }
 g.lineWidth=1
 for(let i=1;i<=4;i++){g.strokeStyle='#91c3cf28';g.beginPath();g.arc(w*.5,h*.47,i*side*.1,0,tau);g.stroke()}
 if(hero===1||hero===3){
   for(let i=0;i<13;i++){const x=w*(.08+i*.07),bend=Math.sin(i*.28)*h*.10
     g.strokeStyle=hero===1?'#e7c68e44':'#d0baff40';g.lineWidth=hero===1?1:4
     g.beginPath();g.moveTo(x,h*.2+bend);g.lineTo(x,h*.82-bend*.3);g.stroke()}
   g.lineWidth=1
 }
 for(const o of nodes){
   const age=t-o.used
   if(!available(o)&&age>240)continue
   const pull=o.pull&&age<240?Math.min(1,age/190):0
   const x=(o.x+(pull?(o.pull.x-o.x)*pull:0))*w,y=(o.y+(pull?(o.pull.y-o.y)*pull:0))*h
   g.globalAlpha=age<240?Math.max(.05,1-age/240):1;g.fillStyle=palette[o.i%6]
   g.beginPath();g.moveTo(x,y-8);g.lineTo(x+6,y);g.lineTo(x,y+8);g.lineTo(x-6,y);g.closePath();g.fill()
   if(hand?.links.includes(o)){g.strokeStyle='#faffdf';g.beginPath();g.arc(x,y,12,0,tau);g.stroke()}
 }
 g.globalAlpha=1
 if(hand){const x=hand.x*w,y=hand.y*h;g.strokeStyle=t-flipped<450?'#ffd799':'#c2f2df'
   g.beginPath();g.arc(x,y,17+hand.depth*14,dir*t*.005,dir*t*.005+5);g.stroke()
   if(hero===3||hero===1||hero===0){g.beginPath();hand.path.forEach((q,i)=>i?g.lineTo(q.x*w,q.y*h):g.moveTo(q.x*w,q.y*h));g.stroke()}
 }
 requestAnimationFrame(frame)
}
pad.onpointerdown=start;pad.onpointermove=e=>{if(hand?.id===e.pointerId)trace(touch(e))}
pad.onpointerup=e=>{if(hand?.id===e.pointerId){trace(touch(e));end(true)}}
pad.onpointercancel=pad.onlostpointercapture=e=>{if(hand?.id===e.pointerId)end(false)}
$('hero').onchange=$('scene').onchange=setup
$('action').onclick=()=>{end(false);if(scene===3)clearBand();else{total=0;field()}status()}
document.addEventListener('visibilitychange',()=>{if(document.hidden){end(false);clearBand();status();ctx?.suspend()}})
new ResizeObserver(resize).observe(pad);resize();setup();requestAnimationFrame(frame)
