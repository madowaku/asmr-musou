/* FEEL LAB v0.5 — flow (horde → 2 upgrade picks → giant boss → big break → afterglow → result),
 * touch-where-you-mean input, HUD, metrics, bots (random / intent / skilled). */
(async function(L){
  'use strict';
  const C=L.combat,W=L.world,$=id=>document.getElementById(id),canvas=$('scene');
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const CLASSES={slasher:{name:'SLASHER',jp:'大剣士',help:['スワイプ：その向きに大きく斬る（続けるとつながる）','タップ：回転斬り','長押し→離す：大回転斬り']},
    crusher:{name:'CRUSHER',jp:'拳闘士',help:['タップ：その敵へ踏み込んで殴る（連打でラッシュ）','殴った直後にはじく：飛ばす向き','長押し→離す：圧縮パンチ']},
    caster:{name:'CASTER',jp:'魔法使い',help:['タップ：その場所に魔法','なぞる：魔法を連ねる','長押し→離す：巨大魔法（吸い込んで弾ける）']}};
  L.config.maxBodies=230; // FEEL only: thicker hordes, so a tighter cap on bodies+debris keeps frames even (combat.html keeps 260)
  Object.assign(window.LAB_ASSETS=window.LAB_ASSETS||{},C.makeHeroSprites());
  let renderer;try{await L.loadAssets();renderer=L.createRenderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent='WebGL2 を開始できません: '+e.message;return;}

  // ---------- run state ----------
  const G={state:'select',cls:'slasher',seed:1,t:0,rt:0,hero:null,boss:null,slow:0,actions:new Map(),stats:null,later:[],bolts:[],glows:[],arcs:[],history:[],headless:false,bot:null,bossDown:false,finaleT:0,paused:false,choice:null,spawnT:0,groupIdx:0,broken:new Map(),gestureT:0,pickPolicy:null};
  C.state=G;
  C.later=(dt,fn)=>G.later.push({at:G.t+dt,fn});
  C.bolt=(a,e)=>G.bolts.push({a:{x:a.x,y:a.y},b:{x:e.x,y:e.y},life:.14,seed:L.random()*1000});
  C.blade=(pts,ws,col)=>G.arcs.push({pts,ws,col,life:.34,total:.34});
  C.glow=(p,r,col)=>G.glows.push({x:p.x,y:p.y,r,col,life:.25,total:.25});
  C.touch=id=>{const a=G.actions.get(id);if(a&&a.firstHit==null)a.firstHit=G.rt;};
  C.locked=e=>!!(G.boss&&C.bossLocked(G.boss,e));
  C.begin=(h,kind,info={})=>{h.action++;h.lastKind=kind;h.idle=0;G.actions.set(h.action,{id:h.action,kind,cls:G.cls,kills:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,level:h.ups.size,inputT:G.gestureT,fireT:G.rt,firstBreak:null,reported:false,info,phase:G.boss?'boss':'rush'});G.stats.actions++;if(G.stats.firstActionT==null)G.stats.firstActionT=G.t;};
  // Every break goes through here: delayed, idempotent, boss layers and multi-hit parts.
  // Break budget: at most 5 fractures per frame; extra breaks roll into the next frames (a natural wave, no spike frames).
  C.hit=(e,fn,h,delay=0,gen=0)=>{const run=()=>{if(e.removed||e.active||!W.bodies.includes(e))return;if(G.breaks>=5){C.later(.001,run);return;}G.breaks++;
      if(e.bossPart&&e.hp>1){C.touch(G.hero.action);e.hp--;e.squash=1;e.pressing={age:0,duration:.18,done:()=>{}};L.events.emit('strain',{material:e.material,amount:.8,rate:3,x:e.x});C.sfx('pound',e);W.rings.push({x:e.x,y:e.y,r0:e.radius*.8,r1:e.radius*1.25,life:.2,total:.2,w:5,color:[1,.9,1]});G.stats.bossHits++;return;}
      e.chainGen=gen;fn();};
    if(delay>0)C.later(delay,run);else run();};
  W.onBreak=(b,opt)=>{const s=G.stats;s.kills++;if(s.firstKillT==null)s.firstKillT=G.t;G.broken.set(b.id,G.t);
    const a=G.actions.get(opt.action);if(a){a.kills++;a.last=G.t;if(a.firstBreak==null)a.firstBreak=G.rt;const gen=b.chainGen||0;if(gen>0){a.chainKills++;a.chainMax=Math.max(a.chainMax,gen);s.chainKills++;}}
    s.byMaterial[b.material]=(s.byMaterial[b.material]||0)+1;if(b.bossPart)G.stats.bossHits++;
    if(G.boss&&b.id===G.boss.core.id)bigBreak();};

  // ---------- flow ----------
  const GROUPS=['dense','mixed','column','dense','guard','mixed','ring','dense','column'];
  const BOSS_HP=[6,4,16]; // outer kohaku plates / soap ring / bead-slime core (hits each)
  const UP_AT=[{t:12},{t:24}]; // time-based: the 'before' phase must last long enough to be felt
  function start(cls=G.cls,seed=G.seed){
    W.clear();L.seed(seed);L.time=0;L.frame=0;W.nextId=1;W.cutId=0;
    Object.assign(G,{cls,seed,t:0,rt:0,hero:C.createHero(cls),boss:null,slow:0,actions:new Map(),later:[],bolts:[],glows:[],arcs:[],bossDown:false,finaleT:0,paused:false,choice:null,spawnT:0,groupIdx:0,broken:new Map(),gestureT:0});
    G.stats={cls,seed,kills:0,actions:0,chainKills:0,best:0,bestChain:0,ups:[],bossTime:null,bossSecs:null,bossDefeated:false,bossHits:0,firstActionT:null,firstKillT:null,byMaterial:{},byLevel:null,latency:null,match:null};
    P.cancel();G.state='play';
    if(!G.headless){$('select').hidden=true;$('result').hidden=true;$('upgrade').hidden=true;$('hud').hidden=false;$('cls').textContent=CLASSES[cls].name+' '+CLASSES[cls].jp;$('help').innerHTML=CLASSES[cls].help.map(s=>`<span>${s}</span>`).join('');$('lv').innerHTML='';}
    spawnGroup(true);spawnGroup();
  }
  // Hordes stream in from the top; no puzzles, no par. There is always something to hit.
  function spawnGroup(inField=false){const f=C.FORMATIONS.find(x=>x.id===GROUPS[G.groupIdx%GROUPS.length]),drift=34+Math.min(30,G.groupIdx*2);G.groupIdx++;
    const form=C.spawnFormation(f,G.hero,drift),ids=new Set(form.ids);
    for(const b of W.bodies)if(ids.has(b.id)){if(f.around){b.drift={x:0,y:0};}else if(!inField){b.y-=330;b.enter=330;}b.dirty=true;}
    G.spawnT=4.2;}
  function aliveGrunts(){let n=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart)n++;return n;}
  function updateFlow(dt){
    if(G.state!=='play')return;
    for(const b of W.bodies){if(b.enter>0&&!b.flying&&!b.active){const m=Math.min(b.enter,300*dt);b.y+=m;b.enter-=m;b.dirty=true;}}
    if(G.bench)return;
    if(!G.boss){G.spawnT-=dt;const n=aliveGrunts();const lv=G.t>=UP_AT[1].t?2:G.t>=UP_AT[0].t?1:0,low=[22,30,38][lv],cap=[46,60,76][lv]; // hordes thicken after each upgrade: the bigger power gets a bigger crowd
      if((n<low&&G.spawnT<3.2)||(G.spawnT<=0&&n<cap)){spawnGroup();if(lv===2&&n<low)spawnGroup();}
      const i=G.stats.ups.length;if(i<2){if(G.t>=UP_AT[i].t)offerUpgrade();}
      else if(G.t>=36)startBoss();}
    if(G.boss&&!G.bossDown){rotateBoss(dt);if(G.t>56)bigBreak(true);}
    if(G.bossDown){G.finaleT+=dt;if(G.finaleT>4.2)finish();}
  }
  // ---------- growth: two picks per run, time stops while choosing ----------
  function offerUpgrade(){if(G.paused)return;const pool=C.UPGRADES[G.cls].filter(u=>!G.hero.ups.has(u.id)).slice();
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(L.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const ch=pool.slice(0,2);G.paused=true;G.choice=ch;P.cancel();
    if(G.headless||G.pickPolicy){choose((G.pickPolicy||(c=>c[0]))(ch));return;}
    C.sfx('pause');$('up-n').textContent=G.stats.ups.length+1;
    $('up-cards').innerHTML=ch.map((u,i)=>`<button class="upcard" data-i="${i}"><b>${u.name}</b><span>${u.desc}</span></button>`).join('');
    for(const b of $('up-cards').querySelectorAll('button'))b.onclick=()=>choose(ch[+b.dataset.i]);
    $('upgrade').hidden=false;}
  function choose(u){const h=G.hero;h.ups.add(u.id);G.stats.ups.push(u.id);G.paused=false;G.choice=null;if(!G.headless){$('upgrade').hidden=true;banner('強化：'+u.name,u.desc);$('lv').innerHTML=G.stats.ups.map(id=>`<i>${C.UPGRADES[G.cls].find(x=>x.id===id).name}</i>`).join('');}
    C.sfx('levelup');h.flashT=.8;W.rings.push({x:h.x,y:h.y,r0:30,r1:260,life:.6,total:.6,w:8,color:[1,.95,.7],alpha:.7});}
  // ---------- boss ----------
  function startBoss(){if(G.boss)return;
    // make room: the boss must always fit under the body cap (oldest debris goes first)
    if(W.bodies.length>170){const deb=W.bodies.filter(b=>b.active).sort((a,b)=>b.age-a.age);for(const b of deb.slice(0,W.bodies.length-170))b.removed=true;const keep=W.bodies.filter(b=>!b.removed);W.bodies.length=0;W.bodies.push(...keep);}
    G.boss=C.spawnBoss();for(const b of W.bodies)if(b.bossPart){b.hp=b.hpMax=b.bossLayer===0?BOSS_HP[0]:b.bossLayer===1?BOSS_HP[1]:BOSS_HP[2];}G.stats.bossTime=G.t;banner('巨大素材ボス','何度でも叩ける。外側から崩れていく。');
    for(const b of W.enemies())if(!b.bossPart){b.drift={x:0,y:70};b.enter=0;}}
  function rotateBoss(dt){const B=G.boss;B.rot=(B.rot||0)+dt*.22;const by=B.cy+Math.sin(G.t*1.3)*8;
    for(const b of W.bodies){if(!b.bossPart||b.active||b.flying||b.removed)continue;if(b.orbit){b.x=B.cx+Math.cos(b.orbit.a+B.rot)*b.orbit.d;b.y=by+Math.sin(b.orbit.a+B.rot)*b.orbit.d;b.angle=B.rot;}else{b.x=B.cx;b.y=by;}b.dirty=true;}}
  function bigBreak(timeUp=false){if(G.bossDown)return;G.bossDown=true;G.stats.bossDefeated=!timeUp;if(!timeUp)G.stats.bossSecs=G.t-G.stats.bossTime;G.slow=timeUp?.4:.9;C.sfx('finale');
    const B=G.boss,list=W.enemies().map(e=>({e,d:Math.hypot(e.x-B.cx,e.y-B.cy)})).sort((a,b)=>a.d-b.d),id=-1;G.actions.set(id,{id,kills:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,system:true,reported:true,info:{}});
    list.forEach(({e,d},i)=>C.hit(e,()=>{const dx=e.x-B.cx,dy=e.y-B.cy,l=Math.hypot(dx,dy)||1;W.shatter(e,1600,{push:{x:dx/l*(300+L.random()*200),y:dy/l*(300+L.random()*200)-120},action:id,cause:'finale',stop:.008});},{action:id},.08+d/900*.5+i*.004));
    W.rings.push({x:B.cx,y:B.cy,r0:40,r1:700,life:.9,total:.9,w:10,color:[1,.95,.85],alpha:.55});
    pop(360,380,timeUp?'TIME UP':'BREAK!!','big');}
  function summarize(){const s=G.stats,lv=[0,1,2].map(()=>({actions:0,kills:0,best:0})),lat=[],match={slashShift:[],jabDist:[],castSnap:[],redirects:0};
    for(const a of G.actions.values()){if(a.system)continue;s.best=Math.max(s.best,a.kills);s.bestChain=Math.max(s.bestChain,a.chainMax);
      lv[a.level].best=Math.max(lv[a.level].best,a.kills);if(a.phase==='rush'){lv[a.level].actions++;lv[a.level].kills+=a.kills;}
      const fb=Math.min(a.firstBreak??1e9,a.firstHit??1e9);if(fb<1e9)lat.push(fb-a.fireT);
      const i=a.info||{};if(a.kind==='slash'&&i.shift!=null)match.slashShift.push(i.shift);if(a.kind==='jab'&&i.input&&i.at)match.jabDist.push(dist(i.input,i.at));if(a.kind==='burst'&&i.snap!=null)match.castSnap.push(i.snap);if(i.redirect)match.redirects++;}
    const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null,pct=(a,q)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(q*b.length))];};
    s.byLevel=lv.map(l=>({...l,per:l.actions?l.kills/l.actions:null}));s.latency={n:lat.length,median:pct(lat,.5),p90:pct(lat,.9)};
    s.match={slashShiftMean:mean(match.slashShift),slashShifted:match.slashShift.filter(x=>x>0).length,slashN:match.slashShift.length,jabDistMean:mean(match.jabDist),jabN:match.jabDist.length,castSnapMean:mean(match.castSnap),castN:match.castSnap.length,redirects:match.redirects};
    return s;}
  function finish(){G.state='result';const s=summarize();G.history.push(JSON.parse(JSON.stringify(s)));if(!G.headless)showResult();}

  // ---------- input: the finger names the place; the hero gets there ----------
  const HOLD=.24;
  const P={ptr:null};
  P.down=p=>{if(G.state!=='play'||G.paused)return;const h=G.hero;G.gestureT=G.rt;P.ptr={start:p,last:p,anchor:p,t0:G.rt,moved:0,fired:0,charging:false,castAt:p,dir:null,redirected:false};
    if(h.cls==='crusher')C.jab(h,p);else if(h.cls==='caster')C.burst(h,p);};
  P.move=p=>{const q=P.ptr;if(!q||G.paused)return;const h=G.hero;q.moved+=dist(p,q.last);q.last=p;
    if(q.charging){h.charge&&(h.charge.p=p);return;}
    if(h.cls==='slasher'){const dx=p.x-q.anchor.x,dy=p.y-q.anchor.y,d=Math.hypot(dx,dy);
      // fire mid-swipe (no waiting for the finger to lift); a long or turning stroke keeps slashing
      if(d>=(q.fired?110:52)){const ux=dx/d,uy=dy/d,turn=q.dir?Math.acos(Math.max(-1,Math.min(1,ux*q.dir.x+uy*q.dir.y))):9;
        if((!q.fired||turn>.5||d>=220)&&G.rt-h.lastSlash>=.07){h.lastSlash=G.rt;if(q.fired)G.gestureT=G.rt;C.slash(h,q.anchor,ux,uy);q.fired++;q.dir={x:ux,y:uy};q.anchor=p;}}}
    else if(h.cls==='crusher'){if(!q.redirected&&q.moved>=40&&G.rt-q.t0<.35){const dx=p.x-q.start.x,dy=p.y-q.start.y,d=Math.hypot(dx,dy)||1;q.redirected=C.redirect(h,dx/d,dy/d);}}
    else if(dist(p,q.castAt)>=115){q.castAt=p;G.gestureT=G.rt;C.burst(h,p);}};
  P.up=p=>{const q=P.ptr;if(!q)return;P.ptr=null;const h=G.hero;if(G.state!=='play'||G.paused)return;if(p)q.last=p;
    if(q.charging&&h.charge){const k=h.charge.k,at=h.charge.p;h.charge=null;C.release(h,at,k);return;}
    if(h.cls==='slasher'&&!q.fired){const dx=q.last.x-q.start.x,dy=q.last.y-q.start.y,d=Math.hypot(dx,dy);if(d<22)C.spin(h,q.start,false);else C.slash(h,q.start,dx/d,dy/d);}};
  P.cancel=()=>{P.ptr=null;if(G.hero)G.hero.charge=null;};
  P.update=()=>{const q=P.ptr,h=G.hero;if(q&&!q.charging&&q.moved<18&&G.rt-q.t0>=HOLD&&!(h.cls==='slasher'&&q.fired)){q.charging=true;h.charge={p:q.last,t0:G.rt,k:0};C.sfx('charge',h);}
    if(h.charge)h.charge.k=Math.min(1,(G.rt-h.charge.t0)/.7);};
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.x)*720/r.width,y:(e.clientY-r.y)*1280/r.height};};
  let pid=null;
  canvas.addEventListener('pointerdown',e=>{if(G.state!=='play'||pid!==null)return;L.audio?.init?.();pid=e.pointerId;canvas.setPointerCapture(e.pointerId);P.down(point(e));e.preventDefault();});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;P.move(point(e));});
  canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pid)return;pid=null;P.up(point(e));});
  canvas.addEventListener('pointercancel',e=>{if(e.pointerId!==pid)return;pid=null;P.cancel();});

  // ---------- simulation step ----------
  function step(dt){
    if(G.state!=='play'||G.paused)return;G.breaks=0;G.rt+=dt;P.update();
    const scale=G.slow>0?.3:1;G.slow=Math.max(0,G.slow-dt);const sdt=dt*scale;G.t+=sdt;L.time=G.t;L.frame++;
    for(let i=G.later.length-1;i>=0;i--)if(G.later[i].at<=G.t){const q=G.later.splice(i,1)[0];q.fn();}
    C.updateHero(G.hero,sdt);C.updateCharge(G.hero,sdt);W.advance(sdt);
    if(W.freeze>0)W.freeze=Math.max(0,W.freeze-dt);else{W.physics(sdt);C.updateProjectiles(sdt);}
    W.decay(sdt);for(const b of G.bolts)b.life-=sdt;G.bolts=G.bolts.filter(b=>b.life>0);for(const g of G.glows)g.life-=sdt;G.glows=G.glows.filter(g=>g.life>0);for(const g of G.arcs)g.life-=sdt;G.arcs=G.arcs.filter(g=>g.life>0);
    for(const a of G.actions.values())if(!a.system&&!a.reported&&G.t-a.last>.45&&G.t-a.t0>.3){a.reported=true;if(a.kills>=3&&!G.headless){pop(Math.max(90,Math.min(630,G.hero.x)),Math.max(300,G.hero.y-110),a.kills+' KO'+(a.chainKills?' · 連鎖'+a.chainKills:''),a.kills>=15?'big':'ko');C.sfx('ko',{n:a.kills});}}
    updateFlow(dt);if(G.bot&&!G.paused)G.bot(dt);
  }

  // ---------- render ----------
  function heroQuad(h){const k=h.move?1.12:1,s=100*k,flip=Math.cos(h.face)<0?-1:1,bob=h.move?0:Math.sin(h.bob*4)*4;let sp=0;if(h.spin>0){h.spin-=1/60;sp=G.t*40;}
    const c=Math.cos(sp),si=Math.sin(sp),P2=(x,y)=>({x:h.x+(x*c-y*si),y:h.y+bob+(x*si+y*c)});const a=P2(-s,-s),b=P2(s,-s),cc=P2(s,s),d=P2(-s,s);
    return [{...a,u:flip>0?0:1,v:0},{...b,u:flip>0?1:0,v:0},{...cc,u:flip>0?1:0,v:1},{...d,u:flip>0?0:1,v:1}];}
  const TINT={slasher:[.4,.7,1],crusher:[1,.5,.3],caster:[.55,.4,1]};
  function circle(p,r,w,col,seg=40,rot=0){let prev=null;for(let i=0;i<=seg;i++){const a=i/seg*6.283+rot,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(prev)renderer.flash(prev,q,w,col);prev=q;}}
  function draw(){
    renderer.begin();
    renderer.line({x:20,y:L.FLOOR+2},{x:700,y:L.FLOOR+2},1,[.5,.6,.8,.25]);
    W.drawBodies(renderer);
    for(const g of G.glows){const k=g.life/g.total;renderer.glow(g.x,g.y,g.r*(1.1-k*.3),[...g.col,.35*k]);}
    for(const b of G.bolts){let prev=b.a;for(let i=1;i<=6;i++){const t=i/6,j=i<6?(Math.sin(b.seed+i*9.1)*14):0,p={x:b.a.x+(b.b.x-b.a.x)*t+j,y:b.a.y+(b.b.y-b.a.y)*t-j};renderer.flash(prev,p,4,[.75,.95,1,b.life/.14]);renderer.flash(prev,p,1.5,[1,1,1,1]);prev=p;}}
    const h=G.hero;if(h){const col=TINT[h.cls];
      if(h.charge){const ch=h.charge,k=ch.k,r=h.cls==='caster'?C.bigRadius(h,k):h.cls==='crusher'?(150+k*90)*(h.ups.has('blast')?1.25:1):250*(h.ups.has('wide')?1.5:1);
        circle(ch.p,r,2+k*3,[...col,.35+k*.45],48,G.t*(h.cls==='caster'?2:0));circle(ch.p,r*(1-k)*.9+8,2,[1,1,1,.5*(1-k)],32);renderer.glow(ch.p.x,ch.p.y,40+k*60,[...col,.35+k*.3]);
        if(k>=1)circle(ch.p,r+6+Math.sin(G.t*30)*3,3,[1,1,1,.7],48);}
      const lv=h.ups.size;renderer.glow(h.x,h.y+70,60,[0,0,0,.35]);renderer.glow(h.x,h.y,70+lv*22+h.flashT*120,[...col,.16+lv*.08+h.flashT*.4]);
      if(lv)circle({x:h.x,y:h.y+4},84+lv*8,1.5+lv,[...col,.22+.1*Math.sin(G.t*6)],36,G.t);
      renderer.mesh('hero/'+h.cls,heroQuad(h),[0,1,2,0,2,3]);}
    // blade crescents: revealed along the swing (0.1 s), then fade — a soft glow body with a bright edge
    for(const g of G.arcs){const age=g.total-g.life,rev=Math.min(1,age/.1),f=Math.min(1,g.life/(g.total*.7)),n=g.pts.length-1,m=Math.ceil(n*rev);
      for(let i=0;i<m;i++){const a=g.pts[i],b=g.pts[i+1],w=(g.ws[i]+g.ws[i+1])/2;renderer.flash(a,b,w*.45*f+1,[...g.col,.42*f]);renderer.flash(a,b,2.4,[1,1,1,.95*f]);}}
    W.drawFx(renderer);renderer.render(W.particles,G.t,W.punch,G.slow>0);
  }
  // ---------- HUD ----------
  const popsEl=$('pops');
  function pop(x,y,text,kind){if(G.headless)return;const d=document.createElement('div');d.className='pop '+(kind||'');d.textContent=text;d.style.left=(x/720*100)+'%';d.style.top=(y/1280*100)+'%';popsEl.appendChild(d);setTimeout(()=>d.remove(),1100);}
  function banner(name,hint){if(G.headless)return;$('banner').innerHTML=`<b>${name}</b><span>${hint}</span>`;$('banner').classList.remove('show');void $('banner').offsetWidth;$('banner').classList.add('show');}
  function hud(){if(G.state!=='play')return;$('time').style.width=Math.max(0,100-G.t/60*100)+'%';$('kills').textContent=G.stats.kills;
    const i=G.stats.ups.length;if(i<2&&!G.boss){const prevT=i?UP_AT[i-1].t:0,k=(G.t-prevT)/(UP_AT[i].t-prevT);$('upbar').style.width=Math.min(100,k*100)+'%';$('upmeter').hidden=false;}else $('upmeter').hidden=true;
    const h=G.hero;$('combo').textContent=h.combo>=3&&G.rt-h.comboT<.75?'×'+h.combo:'';}
  // Personal records per class + which upgrades were tried (per-viewer convenience; storage may be unavailable).
  const BEST_KEY='asmr-feel-best-v05';function loadBest(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'{}');}catch(_){return {};}}function saveBest(b){try{localStorage.setItem(BEST_KEY,JSON.stringify(b));}catch(_){}}
  function bestLine(c){const b=loadBest()[c];return b?`自己ベスト ${b.kills} 撃破 · 一手 ${b.best} · 強化 ${(b.tried||[]).length}/3`:'';}
  function refreshSelectBests(){for(const c of Object.keys(CLASSES)){const el=document.querySelector('#pick-'+c+' em');if(el)el.textContent=bestLine(c);}}
  function showResult(){const s=G.stats,U=C.UPGRADES[s.cls];$('hud').hidden=true;$('result').hidden=false;
    const all=loadBest(),prevB=all[s.cls]||{kills:0,best:0,boss:null,tried:[],last:null},had=prevB.kills>0;
    const rec={kills:s.kills>prevB.kills,best:s.best>prevB.best,boss:s.bossSecs!=null&&(prevB.boss==null||s.bossSecs<prevB.boss)};
    const tried=[...new Set([...(prevB.tried||[]),...s.ups])];
    all[s.cls]={kills:Math.max(prevB.kills,s.kills),best:Math.max(prevB.best,s.best),boss:rec.boss?s.bossSecs:prevB.boss,tried,last:s.kills};saveBest(all);refreshSelectBests();
    const nw=k=>rec[k]&&had?'<i>NEW</i>':'';
    $('r-title').textContent=s.bossDefeated?'すっきり！':'おつかれさま';
    const l0=s.byLevel[0].per,l2=s.byLevel[2].per??s.byLevel[1].per,b0=s.byLevel[0].best,b2=Math.max(s.byLevel[1].best,s.byLevel[2].best);
    $('r-stats').innerHTML=`<div><small>撃破</small><b>${s.kills}</b>${nw('kills')}</div><div><small>一手の最大</small><b>${s.best}</b>${nw('best')}</div><div><small>ボス撃破</small><b>${s.bossSecs!=null?s.bossSecs.toFixed(1)+'<em>秒</em>':'—'}</b>${nw('boss')}</div>`;
    $('r-growth').innerHTML=(b0&&b2?`<p>一手の最大　強化前 <b>${b0}</b> 体 → 強化後 <b>${b2}</b> 体</p>`:'')+(l0!=null&&l2!=null?`<p>一手あたり　<b>${l0.toFixed(1)}</b> 体 → <b>${l2.toFixed(1)}</b> 体</p>`:'')+`<p>今回の強化：${s.ups.map(id=>U.find(u=>u.id===id).name).join(' ＋ ')||'なし'}</p>`
      +(had&&prevB.last!=null?`<p>前回 ${prevB.last} 撃破 → 今回 ${s.kills} 撃破（${s.kills-prevB.last>=0?'+':''}${s.kills-prevB.last}）</p>`:'');
    const untried=U.filter(u=>!tried.includes(u.id));
    $('r-next').innerHTML=untried.length?`強化コレクション ${tried.length}/3 · 次は「${untried.map(u=>u.name).join('」「')}」を試してみる？`:`強化コレクション 3/3 コンプリート · 好きな組み合わせで記録を狙う`;
    const same=G.history.filter(r=>r.seed===G.seed);$('r-compare').innerHTML=same.length>1?'<p>同じ戦場での比較</p>'+same.slice(-4).map(r=>`<div>${CLASSES[r.cls].name}<span>${r.kills} 撃破 · 最大 ${r.best} · ボス ${r.bossSecs!=null?r.bossSecs.toFixed(1)+'秒':'—'}</span></div>`).join(''):'';}
  for(const k of Object.keys(CLASSES)){$('pick-'+k).onclick=()=>{L.audio?.init?.();start(k,G.seed);};$('again-'+k).onclick=()=>{L.audio?.init?.();start(k,G.seed);};}
  $('again').onclick=()=>{L.audio?.init?.();start(G.cls,G.seed);};$('newfield').onclick=()=>{L.audio?.init?.();start(G.cls,(G.seed*7919+13)%100000);};
  $('mute').onclick=()=>{C.muted=!C.muted;L.audio?.setEnabled?.(!C.muted);$('mute').textContent=C.muted?'🔇':'🔊';};

  // ---------- loop ----------
  let prev=0;function frame(ms){const dt=prev?Math.min(.05,(ms-prev)/1000):1/60;prev=ms;const t0=performance.now();step(dt);const t1=performance.now();if(G.state!=='select')draw();hud();const t2=performance.now();C.frameMs=t2-t0;C.updMs=t1-t0;C.drawMs=t2-t1;requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  // ---------- bots (AI objective verification). They play through the same input path (P.down/move/up). ----------
  function seeded(n){let s=n>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
  function makeBot(skill){const rng=seeded(G.seed*977+skill.length*31),script=[];let cd=.3;
    const tap=p=>{script.push({at:G.rt,f:()=>P.down(p)},{at:G.rt+.05,f:()=>P.up(p)});};
    const swipe=(a,b,dur=.1)=>{script.push({at:G.rt,f:()=>P.down(a)});for(let i=1;i<=5;i++){const t=i/5,q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};script.push({at:G.rt+dur*t,f:()=>P.move(q)});}script.push({at:G.rt+dur+.01,f:()=>P.up(b)});};
    const hold=(p,secs)=>{script.push({at:G.rt,f:()=>P.down(p)},{at:G.rt+secs,f:()=>P.up(p)});};
    const cadence=skill==='skilled'?.36:.4;
    const bot=dt=>{while(script.length&&script[0].at<=G.rt+1e-9)script.shift().f();if(script.length)return;cd-=dt;if(cd>0||G.state!=='play')return;cd=cadence;
      const h=G.hero,en=C.targets();if(!en.length)return;
      if(skill==='random'){const p={x:80+rng()*560,y:280+rng()*820},r=rng();if(r<.55)tap(p);else if(r<.92){const a=rng()*6.283,l=150+rng()*150;swipe(p,{x:p.x+Math.cos(a)*l,y:p.y+Math.sin(a)*l});}else hold(p,.8);return;}
      if(skill==='intent'){const t=C.intentTarget(en,rng);bot.last={id:t.id,hp:t.hp,t:G.t};if(h.cls==='slasher'){const a=rng()*6.283,u={x:Math.cos(a),y:Math.sin(a)};swipe({x:t.x-u.x*110,y:t.y-u.y*110},{x:t.x+u.x*110,y:t.y+u.y*110});}else tap({x:t.x,y:t.y});return;}
      // skilled: pick the predicted biggest action (may use holds)
      const pl=C.plan(h,en);if(pl.kind==='tap')tap(pl.p);else if(pl.kind==='swipe')swipe(pl.a,pl.b);else hold(pl.p,pl.secs);};
    bot.idle=()=>!script.length;return bot;}
  // intent = "the clump I am looking at": dense spots attract the eye; a little randomness among the top few.
  C.intentTarget=(en,rng)=>{const pool=G.boss&&!G.bossDown?en.filter(e=>e.bossPart):[];if(pool.length)return pool[Math.floor(rng()*pool.length)];
    const sc=en.map(e=>({e,n:en.filter(o=>dist(o,e)<130).length})).sort((a,b)=>b.n-a.n);return sc[Math.floor(rng()*Math.min(3,sc.length))].e;};
  C.plan=(h,en)=>{const centers=en.slice().sort((a,b)=>en.filter(o=>dist(o,b)<160).length-en.filter(o=>dist(o,a)<160).length).slice(0,6);let best={score:-1};
    if(h.cls==='slasher'){for(const c of centers)for(let i=0;i<12;i++){const a=i/12*Math.PI,ux=Math.cos(a),uy=Math.sin(a),{L0,w}=C.slashBand(h,c,ux,uy),A={x:c.x-ux*L0/2,y:c.y-uy*L0/2},B={x:c.x+ux*L0/2,y:c.y+uy*L0/2};
        const n=en.filter(e=>C.segDist(e,A,B)<=e.radius+w).length;if(n>best.score){const an={x:c.x-ux*L0*.28,y:c.y-uy*L0*.28};best={score:n,kind:'swipe',a:an,b:{x:an.x+ux*90,y:an.y+uy*90}};}}
      const r=250*(h.ups.has('wide')?1.5:1);for(const c of centers){const n=en.filter(e=>dist(e,c)<r).length*.8;if(n>best.score)best={score:n,kind:'hold',p:{x:c.x,y:c.y},secs:.3};}}
    else if(h.cls==='crusher'){for(const e of en){if(e.flying)continue;let m=0;for(let k=-4;k<=4;k++){const a=Math.atan2(e.y-h.y,e.x-h.x)+k*.17;m=Math.max(m,C.rayCount(e,{x:Math.cos(a),y:Math.sin(a)},900,e));}const n=1+Math.min(m,4);if(n>best.score)best={score:n,kind:'tap',p:{x:e.x,y:e.y}};}
      for(const c of centers){const n=en.filter(e=>dist(e,c)<200).length;if(n>=7&&n*.9>best.score)best={score:n*.9,kind:'hold',p:{x:c.x,y:c.y},secs:.95};}}
    else{const r=C.castRadius(h);for(const c of centers){const n=en.filter(e=>dist(e,c)<r).length;if(n>best.score)best={score:n,kind:'tap',p:{x:c.x,y:c.y}};}
      for(const c of centers){const n=en.filter(e=>dist(e,c)<330).length;if(n>=10&&n*.75>best.score)best={score:n*.75,kind:'hold',p:{x:c.x,y:c.y},secs:1.0};}}
    if(best.score<0)best={kind:'tap',p:{x:en[0].x,y:en[0].y}};return best;};

  window.FEEL={
    state:G,start,
    test:{
      // Headless deterministic run: fixed 60 Hz steps; a bot plays through the input path. Returns the metrics.
      simulate(cls,seed,skill,opt={}){G.headless=true;G.pickPolicy=opt.pick?(ch=>ch.find(u=>u.id===opt.pick)||ch[0]):null;start(cls,seed);if(opt.noUpgrades)G.stats.ups=['-','-'];G.bot=makeBot(skill);let n=0;const lim=(opt.seconds||75)*60;
        while(G.state==='play'&&n<lim){step(1/60);n++;}const s=summarize();const r={...JSON.parse(JSON.stringify(s)),seconds:n/60,state:G.state,skill,finaleKills:G.actions.get(-1)?.kills||0};G.bot=null;G.headless=false;G.pickPolicy=null;G.state='select';W.clear();return r;},
      // Boss alone, with a given upgrade set: how long does it take?
      bossOnly(cls,skill,ups=[],seconds=40){G.headless=true;start(cls,1);W.clear();for(const u of ups){G.hero.ups.add(u);G.stats.ups.push(u);}G.stats.ups.length=2;G.t=36.5;startBoss();G.bot=skill?makeBot(skill):null;let n=0;while(G.state==='play'&&!G.bossDown&&n<seconds*60){step(1/60);n++;}
        const r={down:!!G.stats.bossDefeated,secs:n/60,layers:G.boss.layers.map(l=>l.filter(id=>W.bodies.some(b=>b.id===id&&!b.active&&!b.removed)).length),actions:G.stats.actions};G.bot=null;G.headless=false;G.state='select';W.clear();return r;},
      // Growth bench: the same fixed crowd, one action, 2.2 s to settle. Destruction scale per upgrade set.
      bench(cls,ups,skill,trials=24){const rows=[];G.headless=true;
        for(let i=0;i<trials;i++){start(cls,1000+i);W.clear();for(const u of ups)G.hero.ups.add(u);G.stats.ups=['-','-'];G.bench=true;G.groupIdx=[0,1,2,4][i%4];spawnGroup(true);const crowd=W.enemies().length;W.cutCount=0;
          const bot=makeBot(skill);G.bot=bot;let n=0;while(n<180&&G.state==='play'){step(1/60);n++;if(G.stats.actions>=1&&bot.idle())G.bot=null;}
          let k=0,t0=1e9,t1=0;for(const a of G.actions.values()){if(a.system)continue;k+=a.kills;t0=Math.min(t0,a.t0);t1=Math.max(t1,a.last);}
          rows.push({kills:k,share:k/crowd,dur:k?t1-t0:0,actions:G.stats.actions});G.bot=null;}
        G.bench=false;G.headless=false;G.state='select';W.clear();const m=f=>rows.reduce((s,r)=>s+f(r),0)/rows.length;
        return {kills:m(r=>r.kills),share:m(r=>r.share),dur:m(r=>r.dur),actions:m(r=>r.actions),rows};},
      play(cls,seed,skill){start(cls,seed);G.bot=skill?makeBot(skill):null;},
      step,draw,input:P,C,hero:()=>G.hero,
    }
  };
  refreshSelectBests();$('loading').hidden=true;$('select').hidden=false;
})(window.LAB);
