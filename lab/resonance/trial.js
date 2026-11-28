import {makeStudio} from './chamber.js'
const by=id=>document.getElementById(id),field=by('field'),ns=field.namespaceURI
const colors=['#96e6ff','#76e3cc','#ffcf86','#e1aedc','#bfc0ff']
const signs=['M0 -12 9 0 0 12 -9 0Z','M0 -12 Q17 4 6 10 Q-10 18 -10 3 Q-10 -2 0 -12Z','M-9 -6 6 -10 10 7 -6 11Z','M-9 -8H8V8H-9Z','M0 -12 Q4 -4 11 -5 Q6 0 9 8 Q2 6 0 12 Q-3 5 -10 7 Q-6 1 -10 -5 Q-4 -4 0 -12Z']
const guide=['素材をつないで離すと、指の順に響きます。','素材を横切って離すと、ひと呼吸おいて斬り開きます。','素材をタップ。打音が近くの素材へ跳ねます。','素材を囲んで離すと、輪の中から和音が広がります。','素材の近くを長押し。旋風が吸い込み、高速で奏でます。','素材を押して、ゆっくり転がすとガラスが歌います。']
const sel=id=>by(id).selectedIndex
let items=[],pointer=null,trail=[],linked=[],bow=null,ctx,studio,muted=false,interval,rev=0,lastRoll=null,spin=0,freed=0
function svg(tag,attrs,parent=field){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);parent.append(node);return node}
function audio(){if(!ctx){ctx=new AudioContext();studio=makeStudio(ctx);studio.master.gain.value=muted?0:.65}ctx.resume().catch(()=>{});studio.space(!sel('room'))}
function status(){by('status').textContent='リンク '+linked.length+'　·　解放 '+freed}
function layout(type,i){
  const row=Math.floor(i/5), col=i%5, angle=i*.53-1.6
  if(type===0)return [38+(row%2?4-col:col)*60,321-row*76-(row%2?4-col:col)*7]
  if(type===1){const stars=[[31,83],[66,52],[109,87],[163,58],[215,89],[264,73],[289,121],[235,155],[179,135],[129,174],[65,145],[35,194],[79,231],[147,209],[211,240],[274,209],[283,285],[217,308],[157,278],[93,325]];return stars[i]}
  if(type===2)return [160+(22+i*6.45)*Math.cos(angle),184+(19+i*7.25)*Math.sin(angle)]
  const flower=i%4, petal=Math.floor(i/4)*2*Math.PI/5-1.57
  return [86+(flower%2)*145+48*Math.cos(petal),102+Math.floor(flower/2)*153+52*Math.sin(petal)]
}
function draw(){
  rev++;cancel();field.replaceChildren();freed=0;by('guide').textContent=guide[sel('hero')]
  items=Array.from({length:20},(_,i)=>{const [x,y]=layout(sel('layout'),i);const step=i%18;return {x,y,i,k:i%5,n:sel('layout')===3?[0,2,3,5,7][Math.floor(i/4)]:Math.min(step,18-step),ready:true}})
  if(sel('layout')===3){for(let f=0;f<4;f++)svg('polygon',{points:items.filter(o=>o.i%4===f).map(o=>[o.x,o.y]).join(' '),fill:'none',stroke:'#88b5b94a'})}
  else svg('polyline',{points:items.map(o=>[o.x,o.y]).join(' '),fill:'none',stroke:'#88b5b95c','stroke-dasharray':sel('layout')===1?'3 5':'1 0'})
  for(const o of items){
    o.group=svg('g',{transform:'translate('+o.x+' '+o.y+')'})
    svg('circle',{r:17,fill:colors[o.k],opacity:.09},o.group)
    o.gem=svg('path',{d:signs[o.k],fill:colors[o.k],stroke:'#e5ffff','stroke-width':1,class:'gem'},o.group)
    svg('circle',{cx:-2,cy:-3,r:2,fill:'#fffa'},o.group)
  }
  ink=svg('polyline',{fill:'none',stroke:'#ebffdd','stroke-width':2,'pointer-events':'none'})
  status()
}
let ink
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(field.getScreenCTM().inverse())}
function near(p){return items.filter(o=>o.ready).sort((a,b)=>dist(a,p)-dist(b,p))}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)
function note(o,offset=0,w=1,delta=0){
  studio.strike(o.k,(o.n+delta<10?o.n+delta:o.n+delta-5),o.x/320,ctx.currentTime+offset,w,!sel('tone'))
}
function phrase(o,offset,weight=1){
  note(o,offset,weight)
  if(sel('layer')===1){note(o,offset+.016,.44*weight,2);note(o,offset+.027,.32*weight,4)}
  if(sel('layer')===2){for(let i=1;i<=4;i++)note({...o,x:i%2?320-o.x:o.x},offset+i*.066,weight*.43/i,i%3+1)}
}
function free(o,delay=0){
  if(!o.ready)return
  o.ready=false;phrase(o,delay)
  const version=rev
  setTimeout(()=>{if(rev!==version)return;o.group.classList.add('spent');freed++;status()},delay*1000)
  setTimeout(()=>{if(rev!==version)return;o.ready=true;o.group.classList.remove('spent');o.group.setAttribute('transform','translate('+o.x+' '+o.y+')')},1600+delay*1000)
}
function select(o){if(o.ready&&!linked.includes(o)){linked.push(o);o.group.classList.add('selected');note(o,0,.17);status()}}
function inside(o,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>o.y)!==(b.y>o.y)&&o.x<(b.x-a.x)*(o.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
function stroke(p){
  const a=trail.at(-1)||p;if(!trail.length||dist(a,p)>1)trail.push(p);if(trail.length>480)trail=trail.filter((_,i)=>i%2===0||i===trail.length-1)
  ink.setAttribute('points',trail.map(q=>[q.x,q.y]).join(' '))
  if(sel('hero')<=1){
    const steps=Math.max(1,Math.ceil(dist(a,p)/10))
    for(let i=1;i<=steps;i++){const q={x:a.x+(p.x-a.x)*i/steps,y:a.y+(p.y-a.y)*i/steps};near(q).filter(o=>dist(o,q)<(sel('hero')?30:18)).forEach(select)}
  }
  if(sel('hero')===5){
    const o=near(p).find(o=>dist(o,p)<24)
    if(o&&lastRoll!==o){if(lastRoll){free(lastRoll);lastRoll.gem.classList.remove('held')}lastRoll=o;o.gem.classList.add('held');if(bow)bow.move(o.n,o.x/320);else bow=studio.bow(o.n,o.x/320,!sel('tone'))}
  }
}
function cancel(){pointer=null;clearInterval(interval);if(bow)bow.stop();bow=null;lastRoll?.gem.classList.remove('held');lastRoll=null;linked.forEach(o=>o.group.classList.remove('selected'));linked=[];trail=[];ink?.setAttribute('points','');status()}
field.onpointerdown=e=>{
  if(pointer!==null)return
  audio();pointer=e.pointerId;field.setPointerCapture(pointer);const p=point(e);stroke(p)
  if(sel('hero')===2){const hits=near(p);if(hits[0]&&dist(hits[0],p)<30){const root=hits[0];near(root).filter(o=>dist(o,root)<83).slice(0,3).forEach((o,i)=>free(o,i*.11))}}
  if(sel('hero')===4){spin=0;const vortex=()=>{const center=trail.at(-1);const o=near(center).find(o=>dist(o,center)<80+Math.min(70,spin*7));spin++;if(o){o.group.style.transition='transform 100ms, opacity 220ms';o.group.setAttribute('transform','translate('+(.4*o.x+.6*center.x)+' '+(.4*o.y+.6*center.y)+') rotate('+spin*35+')');free(o,.09)}};vortex();interval=setInterval(vortex,85)}
}
field.onpointermove=e=>{if(e.pointerId===pointer)stroke(point(e))}
field.onpointerup=e=>{
  if(e.pointerId!==pointer)return
  const p=point(e);stroke(p)
  if(sel('hero')<=1)linked.forEach((o,i)=>free(o,sel('hero')?.13+i*.055:i*.112))
  if(sel('hero')===3){let picked=items.filter(o=>o.ready&&inside(o,trail));if(!picked.length)picked=near(p).filter(o=>dist(o,p)<55);picked.forEach((o,i)=>free(o,Math.floor(i/3)*.105+i%3*.014))}
  if(lastRoll)free(lastRoll)
  cancel()
}
field.onpointercancel=field.onlostpointercapture=e=>{if(e.pointerId===pointer)cancel()}
by('hero').onchange=by('layout').onchange=draw
by('room').onchange=()=>studio?.space(!sel('room'))
by('mute').onclick=()=>{muted=!muted;audio();studio.master.gain.setTargetAtTime(muted?0:.65,ctx.currentTime,.02);by('mute').textContent=muted?'音 OFF':'音 ON';by('mute').setAttribute('aria-pressed',String(muted))}
let listenUntil=0
by('listen').onclick=()=>{audio();if(ctx.currentTime<listenUntil)return;listenUntil=ctx.currentTime+2.4;[0,2,3,5,3].forEach((n,i)=>phrase({k:i,n,x:60+i*50},i*.32,.9))}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();ctx?.suspend()}})
draw()
