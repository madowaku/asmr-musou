/* SPIN LAB v0.1 — centre-fixed rotation: the front sector breaks, the back sector collects.
 * One rule under test (spec): "前は破壊、背中は回収". Reuses the v0.3 material engine through combat/world.js
 * (cutting, caps, particles, material audio) without modifying it. Angles: 0 = up, clockwise positive. */
(async function(L){
  'use strict';
  const S=L.spin,W=L.world,$=id=>document.getElementById(id),canvas=$('scene'),arenaEl=$('arena');
  const TAU=Math.PI*2,DEG=Math.PI/180,CX=360,CY=660;
  const Q=new URLSearchParams(location.search);
  // Tunables (spec values; URL overrides are for playtest comparisons only, not UI)
  const P={
    half0:60*DEG,halfStep:7.5*DEG,halfMax:90*DEG,     // front 120° → +15° per item → max 180°
    backHalf:30*DEG,                                    // back 60°
    reach0:205,reachStep:12,collectR:200,heroR:46,      // judgement distances from the centre
    maxLv:4,comboWindow:2.0,burstGap:.2,breakBudget:6,chainR:118,chainMax:8,
    rotPerHalfScreen:(+Q.get('rot')||180)*DEG,invert:Q.get('invert')==='1',auto:Q.get('mode')==='auto',autoRate:150*DEG
  };
  L.config.maxBodies=420;
  const wrap=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;};
  const angOf=(x,y)=>Math.atan2(x-CX,-(y-CY));                 // 0 = up, clockwise
  const posAt=(a,r)=>({x:CX+Math.sin(a)*r,y:CY-Math.cos(a)*r});
  const dist=o=>Math.hypot(o.x-CX,o.y-CY);
  const half=()=>Math.min(P.halfMax,P.half0+G.lv*P.halfStep),reach=()=>P.reach0+G.lv*P.reachStep;
  // Is angle a inside the sector swept from facing `from` to `to` (unwrapped), widened by h on both sides?
  function inSweep(a,from,to,h){const mid=(from+to)/2,span=Math.abs(to-from)/2+h;if(span>=Math.PI)return true;return Math.abs(wrap(a-mid))<=span+1e-9;}

  let renderer;try{await L.loadAssets();renderer=L.createRenderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent='WebGL2 を開始できません: '+e.message;return;}

  const G={state:'title',mode:'main',seed:1,t:0,theta:0,judged:0,lv:0,events:[],evi:0,pending:[],items:[],queue:[],stats:null,combo:0,comboT:-9,burst:null,
    nextItemId:1,resolved:new Map(),headless:false,bot:null,endT:null,swing:0,tips:[],hintShown:false,lastWhoosh:0,locked:false,stageDef:null,hold:0};
  S.state=G;

  // ---------- run setup ----------
  function start(mode=G.mode,seed=G.seed){
    W.clear();L.seed(seed);L.time=0;L.frame=0;W.nextId=1;W.cutId=0;
    Object.assign(G,{mode,seed,t:0,theta:0,judged:0,lv:0,evi:0,pending:[],items:[],queue:[],combo:0,comboT:-9,burst:null,nextItemId:1,resolved:new Map(),outcome:new Map(),endT:null,swing:0,tips:[],hintShown:false,locked:false,hold:0});
    G.stageDef=mode==='main'?null:S.STAGES[mode];
    G.events=mode==='main'?S.buildMain(L.random):G.stageDef.build();
    G.stats={mode,seed,score:0,kills:0,chainKills:0,maxBurst:0,maxCombo:0,items:0,itemsBroken:0,itemsMissed:0,contacts:0,maxLv:0,
      killsByLv:[0,0,0,0,0],firstItemOutcome:null,firstItemT:null,spawned:0,itemsSpawned:0,burstByLv:[0,0,0,0,0]};
    G.state='play';
    if(!G.headless){$('title').hidden=true;$('result').hidden=true;$('hud').hidden=false;$('help').classList.remove('fade');
      if(G.stageDef)banner(G.stageDef.name,G.stageDef.goal);else banner('SPIN LAB','左右にドラッグして、前で斬る');}
  }
  // ---------- spawning ----------
  const MAT_SIZE={wax:[24,30],jelly:[25,31],kohaku:[23,28]};
  function queueEnemy(mat,a,r,spd){const [r0,r1]=MAT_SIZE[mat];G.pending.push({mat,a,r,spd,size:r0+L.random()*(r1-r0)});G.stats.spawned++;}
  function materialize(p){const q=posAt(p.a,p.r),b=W.spawn(p.mat,q.x,q.y,p.size);if(!b)return false;
    b.spd=p.spd;b.phase=L.random()*TAU;b.kick={x:0,y:0};if(p.mat==='kohaku')b.baseTexture='spin/ice';return true;}
  function spawnEvent(ev){const R=L.random,pick=a=>a[Math.floor(R()*a.length)],A=ev.ang*DEG;
    if(ev.type==='item'){const a=ev.rel?G.theta:A;G.items.push({id:G.nextItemId++,a,r:ev.r0,spd:ev.spd,state:'in',t:0,x:0,y:0,first:G.stats.itemsSpawned===0});G.stats.itemsSpawned++;
      if(ev.hint&&!G.headless){banner(G.stageDef?G.stageDef.hint:'光るアイテム','前で斬ると壊れる。背中の袋で受け取ると剣が育つ。');}return;}
    if(ev.type==='group'){for(let i=0;i<ev.n;i++){const k=ev.n>1?i/(ev.n-1)-.5:0;queueEnemy(pick(ev.mats),A+(k*ev.spread+(R()-.5)*6)*DEG,ev.r0+R()*ev.depth,ev.spd*(.92+R()*.16));}return;}
    if(ev.type==='arc'){for(let i=0;i<ev.n;i++){const k=ev.n>1?i/(ev.n-1)-.5:0;queueEnemy(pick(ev.mats),A+k*ev.width*DEG,ev.r0+(R()-.5)*14,ev.spd);}return;}
    if(ev.type==='clump'){const gap=56,rows=ev.rows;for(let j=0;j<rows;j++)for(let i=0;i<rows-(j&1);i++){const tx=(i-(rows-1-(j&1))/2)*gap,rr=ev.r0+j*gap*.86;queueEnemy(pick(ev.mats),A+Math.atan2(tx,rr),Math.hypot(tx,rr),ev.spd);}}
  }

  // ---------- results of judgement (each target resolves exactly once) ----------
  function resolve(kind,id,what){const k=kind+id,n=(G.resolved.get(k)||0)+1;G.resolved.set(k,n);if(n===1)G.outcome.set(k,what);if(n>1)G.stats.doubleResolved=(G.stats.doubleResolved||0)+1;return n===1;}
  function slash(e,gen=0,delay=0,cause='slash'){if(e.resolved)return;e.resolved=true;resolve('e',e.id,cause);G.queue.push({e,gen,at:G.t+delay,cause});}
  function runBreak(q){const e=q.e;if(!W.bodies.includes(e)||e.removed||e.active)return;
    const d=dist(e)||1,ux=(e.x-CX)/d,uy=(e.y-CY)/d,tx=-uy,ty=ux,R=e.radius*2.6,o={x:e.x+ux*2,y:e.y+uy*2};
    const path=[{x:o.x-tx*R,y:o.y-ty*R},{x:o.x+tx*R,y:o.y+ty*R}],opt={push:{x:ux*230+tx*70,y:uy*230+ty*70},gen:q.gen,cause:q.cause,stop:q.gen?.006:.012};
    if(!W.cut(e,path,1500,opt)&&!W.shatter(e,1200,opt)){L.removeBody(e);onKill(e,opt);}}
  W.onBreak=(b,opt)=>onKill(b,opt);
  function onKill(b,opt){const s=G.stats,gen=opt.gen||0;s.kills++;s.killsByLv[G.lv]++;s.score+=10+(gen?5*Math.min(gen,6):0);if(gen)s.chainKills++;
    G.combo++;G.comboT=G.t;s.maxCombo=Math.max(s.maxCombo,G.combo);
    if(G.burst&&G.t-G.burst.last<=P.burstGap){G.burst.n++;G.burst.last=G.t;}else{flushBurst();G.burst={n:1,last:G.t,lv:G.lv,x:b.x,y:b.y};}
    if(b.material==='kohaku'&&gen<P.chainMax){ // ice: shards fly to close neighbours and break them (chain)
      for(const o of W.enemies()){if(o.resolved||o===b)continue;const dd=Math.hypot(o.x-b.x,o.y-b.y);if(dd<P.chainR+o.radius){slash(o,gen+1,.07+dd/2400,'chain');
        W.trails.push({a:{x:b.x,y:b.y},b:{x:o.x,y:o.y},life:.2,total:.2,w:3,color:[.75,.95,1],alpha:.9});}}
      for(let i=0;i<7;i++){const a=L.random()*TAU,sp=160+L.random()*260;L.addParticle({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:3+L.random()*3,color:[.8,.96,1,1],life:.4,g:0,drag:3});}
      sfx('shard',b);}
    if(b.material==='jelly'){ // jelly: a soft shove outward from the burst
      for(const o of W.enemies()){if(o===b)continue;const dx=o.x-b.x,dy=o.y-b.y,dd=Math.hypot(dx,dy)||1;if(dd<150){const k=(1-dd/150)*240;o.kick.x+=dx/dd*k;o.kick.y+=dy/dd*k;}}
      W.rings.push({x:b.x,y:b.y,r0:b.radius,r1:150,life:.25,total:.25,w:3,color:[.6,1,.9],alpha:.35});}}
  function flushBurst(){const b=G.burst;if(!b)return;G.burst=null;G.stats.maxBurst=Math.max(G.stats.maxBurst,b.n);G.stats.burstByLv[b.lv]=Math.max(G.stats.burstByLv[b.lv],b.n);
    if(b.n>=4)pop(b.x,b.y-30,b.n+' KO',b.n>=10?'big':'ko');}

  // ---------- items ----------
  function collect(it){if(!resolve('i',it.id,'collect'))return;it.state='collect';it.t=0;it.from={x:it.x,y:it.y};G.stats.items++;G.stats.score+=30;
    if(it.first){G.stats.firstItemOutcome='collected';G.stats.firstItemT=G.t;}sfx('collect',it);}
  function breakItem(it){if(!resolve('i',it.id,'break'))return;it.state='broken';it.t=0;G.stats.itemsBroken++;if(it.first){G.stats.firstItemOutcome='broken';G.stats.firstItemT=G.t;}
    for(let i=0;i<16;i++){const a=L.random()*TAU,sp=80+L.random()*240;L.addParticle({x:it.x,y:it.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:3+L.random()*4,color:[1,.85,.5,1],life:.5+L.random()*.3,g:0,drag:2.5});}
    pop(it.x,it.y-40,'壊れた… 背中で受け取ろう','lost');sfx('itemBreak',it);}
  function missItem(it){if(!resolve('i',it.id,'miss'))return;it.state='miss';it.t=0;G.stats.itemsMissed++;if(it.first){G.stats.firstItemOutcome='missed';G.stats.firstItemT=G.t;}sfx('miss',it);}
  function levelUp(it){if(G.lv<P.maxLv){G.lv++;G.stats.maxLv=G.lv;const deg=Math.round(half()*2/DEG);pop(CX,CY-150,'剣が育った！ '+deg+'°','up');sfx('levelup',it,G.lv);
      W.rings.push({x:CX,y:CY,r0:60,r1:reach()+40,life:.5,total:.5,w:8,color:[1,.8,.5],alpha:.6});}
    else{pop(CX,CY-150,'MAX +30','get');sfx('levelup',it,G.lv);}
    W.rings.push({x:CX,y:CY,r0:20,r1:90,life:.35,total:.35,w:5,color:[.6,.9,1],alpha:.7});}

  // ---------- simulation step ----------
  function sfx(k,at,lv){if(!G.headless&&S.sfx)S.sfx(k,at,lv);}
  function step(dt){
    if(G.state!=='play')return;
    G.t+=dt;L.time=G.t;L.frame++;
    // spawns
    while(G.evi<G.events.length&&G.events[G.evi].t<=G.t)spawnEvent(G.events[G.evi++]);
    for(let i=G.pending.length-1;i>=0;i--){const p=G.pending[i];p.r-=p.spd*dt;if(p.r<=585&&materialize(p))G.pending.splice(i,1);}
    // rotation (auto mode = comparison candidate)
    if(P.auto&&!G.locked)G.theta+=P.autoRate*dt;
    if(G.bot)G.bot(dt);
    const from=G.judged,to=G.theta,h=half(),rr=reach();G.judged=G.theta;
    if(!G.headless&&Math.abs(to-from)>.11&&G.t-G.lastWhoosh>.15){G.lastWhoosh=G.t;sfx('whoosh',posAt(to,120),G.lv);}
    // approach
    for(const e of W.enemies()){if(e.spd==null)continue;const d=dist(e)||1,ux=(CX-e.x)/d,uy=(CY-e.y)/d;
      let sp=e.spd;if(e.material==='jelly'){e.phase+=dt*7;sp*=.35+1.3*Math.abs(Math.sin(e.phase));e.squash=Math.max(e.squash||0,.25*Math.abs(Math.cos(e.phase)));}
      e.drift={x:ux*sp+e.kick.x,y:uy*sp+e.kick.y};const k=Math.exp(-5*dt);e.kick.x*=k;e.kick.y*=k;}
    // judgement: items first (back collects before front breaks), then enemies
    for(const it of G.items){if(it.state!=='in')continue;
      if(it.r<=P.collectR&&inSweep(it.a,from+Math.PI,to+Math.PI,P.backHalf))collect(it);
      else if(it.r<=rr&&inSweep(it.a,from,to,h))breakItem(it);
      else if(it.r<=P.heroR*.5)missItem(it);}
    for(const e of W.enemies()){if(e.resolved||e.spd==null)continue;const d=dist(e),a=angOf(e.x,e.y);
      if(d-e.radius*.5<=rr&&inSweep(a,from,to,h))slash(e);
      else if(d<=P.heroR+e.radius*.4){e.resolved=true;resolve('e',e.id,'contact');L.removeBody(e);G.stats.contacts++;
        if(G.combo>=5)pop(CX,CY-90,'COMBO '+G.combo+' → 0','lost');G.combo=0;G.hold=.12;sfx('bump',e);
        for(let i=0;i<8;i++){const q=L.random()*TAU;L.addParticle({x:e.x,y:e.y,vx:Math.cos(q)*90,vy:Math.sin(q)*90,size:4,color:[.8,.8,.9,.8],life:.35,g:0,drag:3});}}}
    // breaks (budget per frame; extra ones roll into the next frames)
    let n=0;G.queue.sort((a,b)=>a.at-b.at);while(G.queue.length&&G.queue[0].at<=G.t&&n<P.breakBudget){runBreak(G.queue.shift());n++;}
    // items move / animate
    for(const it of G.items){it.t+=dt;if(it.state==='in'){it.r-=it.spd*dt;const q=posAt(it.a,it.r);it.x=q.x;it.y=q.y;}
      else if(it.state==='collect'&&it.t>=.28&&!it.done){it.done=true;levelUp(it);}}
    G.items=G.items.filter(it=>it.state==='in'||(it.state==='collect'&&it.t<.5)||(it.state==='miss'&&it.t<.4));
    // world
    W.advance(dt);if(W.freeze>0)W.freeze=Math.max(0,W.freeze-dt);else W.physics(dt);W.decay(dt);
    G.hold=Math.max(0,G.hold-dt);G.swing+=dt;
    if(G.combo&&G.t-G.comboT>P.comboWindow)G.combo=0;
    if(G.burst&&G.t-G.burst.last>P.burstGap)flushBurst();
    if(G.t>10&&!G.headless)$('help').classList.add('fade');
    // flow
    if(G.mode==='main'){if(G.t>=60)finish();}
    else if(G.stageDef){const live=G.pending.length||G.items.some(i=>i.state==='in')||W.enemies().some(e=>!e.resolved)||G.queue.length;
      if(G.evi>=G.events.length&&!live){G.endT??=G.t;if(G.t-G.endT>1.4)finish();}if(G.t>30)finish();}
  }
  // top-down debris: no gravity toward the screen bottom, pieces and dust slide out and settle
  L.updateHooks.push(dt=>{if(!S.state||S.state.state!=='play')return;const k=Math.exp(-2.4*dt);
    for(const b of W.bodies)if(b.active){if(b.gScale!==0){b.gScale=0;}b.vx*=k;b.vy*=k;b.spin*=Math.exp(-1.2*dt);}
    for(const p of W.particles)if(!p.topdown){p.topdown=1;p.g=(p.g??620)*.05;p.drag=Math.max(p.drag||0,2.2);p.floor=false;}});
  function finish(){if(G.state!=='play')return;flushBurst();G.state='result';sfx('end');if(!G.headless)showResult();}

  // ---------- input: drag left/right anywhere to rotate (tap does nothing) ----------
  let ptr=null;
  arenaEl.addEventListener('pointerdown',e=>{if(G.state!=='play'||e.target.closest('button'))return;L.audio?.init?.();if(ptr)return;ptr={id:e.pointerId,x:e.clientX,x0:e.clientX,y0:e.clientY,t0:performance.now(),moved:0};try{arenaEl.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
  arenaEl.addEventListener('pointermove',e=>{if(!ptr||e.pointerId!==ptr.id)return;const dx=e.clientX-ptr.x;ptr.x=e.clientX;ptr.moved+=Math.abs(dx);
    if(P.auto)return;const w=canvas.getBoundingClientRect().width||360;G.theta+=dx/(w/2)*P.rotPerHalfScreen*(P.invert?-1:1);});
  const up=e=>{if(!ptr||e.pointerId!==ptr.id)return;if(P.auto&&ptr.moved<12)G.locked=!G.locked;ptr=null;};
  arenaEl.addEventListener('pointerup',up);arenaEl.addEventListener('pointercancel',up);

  // ---------- render ----------
  const fanVerts=[],fanIdx=[];
  function fan(name,a0,a1,r0,r1,color,seg=28){fanVerts.length=fanIdx.length=0;for(let i=0;i<=seg;i++){const a=a0+(a1-a0)*i/seg,p=posAt(a,r0),q=posAt(a,r1);fanVerts.push({x:p.x,y:p.y,u:0,v:0},{x:q.x,y:q.y,u:0,v:0});if(i<seg){const k=i*2;fanIdx.push(k,k+1,k+3,k,k+3,k+2);}}renderer.mesh(name,fanVerts,fanIdx,color,1);}
  function arcLine(a0,a1,r,w,color,seg=28){let prev=posAt(a0,r);for(let i=1;i<=seg;i++){const p=posAt(a0+(a1-a0)*i/seg,r);renderer.flash(prev,p,w,color);prev=p;}}
  function quad(name,cx,cy,w,h,a,ox=0,oy=0){const c=Math.cos(a),s=Math.sin(a),P2=(x,y)=>({x:cx+(x+ox)*c-(y+oy)*s,y:cy+(x+ox)*s+(y+oy)*c});
    const v=[{...P2(-w/2,-h/2),u:0,v:0},{...P2(w/2,-h/2),u:1,v:0},{...P2(w/2,h/2),u:1,v:1},{...P2(-w/2,h/2),u:0,v:1}];renderer.mesh(name,v,[0,1,2,0,2,3]);}
  let ordered=false;
  function draw(){
    renderer.begin();
    // fix the draw order once: floor → zones → enemies → items → hero (batches draw in first-use order)
    if(!ordered){ordered=true;for(const n of ['spin/floor','spin/fan','body/wax_grunt','body/jelly_grunt','spin/ice','spin/item','spin/sword','spin/hero'])renderer.mesh(n,[],[]);}
    quad('spin/floor',CX,CY,704,704,0);
    const th=G.theta,h=half(),rr=reach(),lvk=G.lv/P.maxLv;
    // zones: warm front fan (attack), cool back fan (collect)
    fan('spin/fan',th-h,th+h,P.heroR,rr,[1,.6,.28,.2+.06*lvk]);
    fan('spin/fan',th+Math.PI-P.backHalf,th+Math.PI+P.backHalf,P.heroR,P.collectR,[.45,.8,1,.24]);
    W.drawBodies(renderer);
    // items
    for(const it of G.items){let x=it.x,y=it.y,s=1,al=1;
      if(it.state==='collect'){const k=Math.min(1,it.t/.28),back=posAt(th+Math.PI,60);x=it.from.x+(back.x-it.from.x)*k*k;y=it.from.y+(back.y-it.from.y)*k*k;s=1-k*.7;al=it.t<.28?1:Math.max(0,1-(it.t-.28)/.2);}
      else if(it.state==='miss'){s=1-it.t*2;al=1-it.t/.4;}
      if(al<=0||s<=0)continue;const pulse=1+.08*Math.sin(G.t*7+it.id);
      renderer.glow(x,y,70*s*pulse,[1,.8,.45,.45*al]);quad('spin/item',x,y,78*s*pulse,78*s*pulse,Math.sin(G.t*2+it.id)*.25);
      if(it.state==='in'&&(x<8||x>712||y<8||y>1272)){const ex=Math.max(26,Math.min(694,x)),ey=Math.max(110,Math.min(1254,y));renderer.glow(ex,ey,46+10*Math.sin(G.t*9),[1,.82,.45,.85]);}}
    // hero + sword (swinging inside the front sector) + trail
    const sw=th+h*.78*Math.sin(G.swing*TAU/.6),len=rr*.98,swW=len*.36*(1+lvk*.25);
    const tip=posAt(sw,len);G.tips.unshift(tip);if(G.tips.length>9)G.tips.length=9;
    for(let i=1;i<G.tips.length;i++)renderer.flash(G.tips[i-1],G.tips[i],(10+lvk*10)*(1-i/9),[1,.85,.55,.45*(1-i/9)]);
    arcLine(th-h,th+h,rr,3+lvk*2,[1,.75,.45,.55]);arcLine(th+Math.PI-P.backHalf,th+Math.PI+P.backHalf,P.collectR,3,[.55,.85,1,.6],10);
    const base=posAt(sw,len/2+18);quad('spin/sword',base.x,base.y,swW,len,sw);
    renderer.glow(CX,CY+6,64,[0,0,0,.35]);if(G.hold>0)renderer.glow(CX,CY,90,[1,1,1,.3]);
    {const bk=posAt(th+Math.PI,60);renderer.glow(bk.x,bk.y,56,[.5,.85,1,.28]);}
    quad('spin/hero',CX,CY,190,190,th);
    W.drawFx(renderer);renderer.render(W.particles,G.t,W.punch,false);
  }
  // ---------- HUD ----------
  const popsEl=$('pops');
  function pop(x,y,text,kind){if(G.headless)return;const d=document.createElement('div');d.className='pop '+(kind||'');d.textContent=text;d.style.left=(x/720*100)+'%';d.style.top=(y/1280*100)+'%';popsEl.appendChild(d);setTimeout(()=>d.remove(),1100);}
  function banner(name,hint){if(G.headless)return;$('banner').innerHTML=`<b>${name}</b><span>${hint}</span>`;$('banner').classList.remove('show');void $('banner').offsetWidth;$('banner').classList.add('show');}
  function hud(){if(G.state!=='play')return;const dur=G.mode==='main'?60:30;$('time').style.width=Math.max(0,100-G.t/dur*100)+'%';$('score').textContent=G.stats.score;$('kills').textContent=G.stats.kills;
    $('lv').textContent='剣 '+Math.round(half()*2/DEG)+'°'+(G.lv>=P.maxLv?' MAX':'');$('combo').innerHTML=G.combo>=3?G.combo+'<small>COMBO</small>':'';}
  const BEST_KEY='asmr-spin-best-v01';function loadBest(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'{}');}catch(_){return {};}}function saveBest(b){try{localStorage.setItem(BEST_KEY,JSON.stringify(b));}catch(_){}}
  function showResult(){const s=G.stats;$('hud').hidden=true;$('result').hidden=false;
    const all=loadBest(),prev=all[s.mode]||0,isNew=s.score>prev&&prev>0;all[s.mode]=Math.max(prev,s.score);saveBest(all);
    $('r-eyebrow').textContent=G.stageDef?'研究モード '+G.stageDef.name:'RESULT · 60秒';
    $('r-title').textContent=G.stageDef?(s.items&&!s.itemsBroken?'受け取れた！':'もう一回ためす'):'すっきり！';
    $('r-score').innerHTML=s.score+'<small>点'+(isNew?' · NEW':prev?' · ベスト '+prev:'')+'</small>';
    $('r-stats').innerHTML=`<div><small>総撃破数</small><b>${s.kills}</b></div><div class="warm"><small>最大同時撃破</small><b>${s.maxBurst}</b></div><div><small>最大コンボ</small><b>${s.maxCombo}</b></div>`+
      `<div class="cool"><small>アイテム取得</small><b>${s.items}</b></div><div><small>アイテム破壊</small><b>${s.itemsBroken}</b></div><div><small>連鎖撃破</small><b>${s.chainKills}</b></div>`;
    $('r-note').textContent=G.stageDef?'気づき：'+G.stageDef.goal:`剣 ${Math.round(half()*2/DEG)}° まで成長 · 中心に触れた敵 ${s.contacts}`;}
  $('play').onclick=()=>{L.audio?.init?.();start('main',G.seed);};
  for(const k of ['A','B','C'])$('stage-'+k).onclick=()=>{L.audio?.init?.();start(k,1);};
  $('again').onclick=()=>{L.audio?.init?.();start(G.mode,G.mode==='main'?(G.seed*7919+13)%100000:1);};
  $('totitle').onclick=()=>{G.state='title';W.clear();$('result').hidden=true;$('title').hidden=false;};
  $('mute').onclick=()=>{S.muted=!S.muted;L.audio?.setEnabled?.(!S.muted);$('mute').textContent=S.muted?'🔇':'🔊';};

  // ---------- loop ----------
  let prevMs=0;function frame(ms){const dt=prevMs?Math.min(.05,(ms-prevMs)/1000):1/60;prevMs=ms;const t0=performance.now();step(dt);const t1=performance.now();if(G.state!=='title')draw();hud();S.frameMs=performance.now()-t0;S.updMs=t1-t0;requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  // ---------- bots (objective checks only; not a measure of fun) ----------
  function turnToward(target,dt,rate=9){const d=wrap(target-G.theta),m=rate*dt;G.theta+=Math.max(-m,Math.min(m,d));}
  function makeBot(kind){let tgt=0,cd=0;const rng=(()=>{let s=G.seed*977+kind.length;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);})();
    return dt=>{const live=W.enemies().filter(e=>!e.resolved&&e.spd!=null);
      if(kind==='idle')return;
      if(kind==='random'){cd-=dt;if(cd<=0){cd=.4+rng()*.6;tgt=G.theta+(rng()-.5)*Math.PI*1.6;}turnToward(tgt,dt,6);return;}
      const near=live.reduce((b,e)=>!b||dist(e)<dist(b)?e:b,null);
      if(kind==='naive'){if(near)turnToward(angOf(near.x,near.y),dt);return;}
      // skilled: receive an item whose arrival is imminent unless an enemy would reach the body first; else face the densest threat
      const it=G.items.filter(i=>i.state==='in').sort((a,b)=>a.r-b.r)[0];
      const danger=near&&dist(near)<P.heroR+70&&!(it&&it.r<P.collectR+40);
      if(it&&it.r<P.collectR+150&&!danger){turnToward(it.a+Math.PI,dt);return;}
      let best=null,bs=-1;for(let i=0;i<36;i++){const a=i/36*TAU;let sc=0;for(const e of live){const d=dist(e);if(d>reach()+260)continue;if(Math.abs(wrap(angOf(e.x,e.y)-a))<=half()*.9)sc+=1+(reach()+260-d)/200;}
        // avoid facing an item that is already within reach
        for(const i2 of G.items)if(i2.state==='in'&&i2.r<reach()+60&&Math.abs(wrap(i2.a-a))<=half()+.1)sc-=12;
        if(sc>bs){bs=sc;best=a;}}
      if(best!=null&&bs>0)turnToward(best,dt);};}

  window.SPIN={state:G,P,start,
    test:{
      simulate(bot,seed,mode='main',seconds=70){G.headless=true;start(mode,seed);G.bot=makeBot(bot);let n=0;while(G.state==='play'&&n<seconds*60){step(1/60);n++;}
        const s={...G.stats,bot,seconds:+(n/60).toFixed(2),state:G.state,finalLv:G.lv,leftover:G.pending.length+W.enemies().filter(e=>!e.resolved).length};G.bot=null;G.headless=false;G.state='title';W.clear();return s;},
      play(mode,seed,bot){G.headless=false;start(mode,seed);G.bot=bot?makeBot(bot):null;},
      // scene probes for the technical checks
      blank(){G.headless=true;start('A',1);G.events=[];G.evi=0;G.pending=[];W.clear();G.items=[];G.stats.itemsSpawned=0;G.stageDef=null;G.mode='probe';},
      enemy(deg,r,mat='wax'){const q=posAt(deg*DEG,r),b=W.spawn(mat,q.x,q.y,26);b.spd=0;b.phase=0;b.kick={x:0,y:0};return b.id;},
      item(deg,r,spd=0){const it={id:G.nextItemId++,a:deg*DEG,r,spd,state:'in',t:0,x:0,y:0,first:false};const q=posAt(it.a,r);it.x=q.x;it.y=q.y;G.items.push(it);return it.id;},
      itemState:id=>G.outcome.get('i'+id)||'in',
      enemyAlive:id=>W.bodies.some(b=>b.id===id&&!b.removed&&!b.active&&!b.resolved),
      setTheta(deg){G.theta=G.judged=deg*DEG;},turn(deg){G.theta+=deg*DEG;},
      setLv(lv){G.lv=lv;},geometry:()=>({half:half()/DEG,reach:reach(),back:P.backHalf/DEG,collectR:P.collectR,lv:G.lv}),
      step(n=1,dt=1/60){for(let i=0;i<n;i++)step(dt);},
      stats:()=>({...G.stats}),draw,hero:()=>({theta:G.theta/DEG,lv:G.lv}),
      end(){G.bot=null;G.headless=false;G.state='title';W.clear();}
    }};
  $('loading').hidden=true;$('title').hidden=false;
})(window.LAB);
