/* COMBAT LAB v0.4 — flow (rush → boss → big break → afterglow → result), input grammar, HUD, metrics, bots. */
(async function(L){
  'use strict';
  const C=L.combat,W=L.world,$=id=>document.getElementById(id),canvas=$('scene');
  const CLASSES={slasher:{name:'SLASHER',jp:'大剣士',flick:'なぞる：軌跡どおりに突進斬り',hold:'長押し→引いて離す：溜め突進（硬いチョークも斬れる）',tap:'タップ：回転斬り'},
    crusher:{name:'CRUSHER',jp:'拳闘士',flick:'なぞる：突進パンチ。殴った敵が弾になる',hold:'長押し→引いて離す：溜めパンチ（貫通する弾）',tap:'タップ：地面打ち（周りを押し潰す）'},
    caster:{name:'CASTER',jp:'魔法使い',flick:'なぞる：風で敵を押し流す（仕込み）',hold:'長押し→引いて離す：重力球で集めて圧縮',tap:'タップ：雷。濡れた素材を伝って連鎖'}};
  // ---------- assets (hero sprites are procedural; they go through the same bundle path) ----------
  Object.assign(window.LAB_ASSETS=window.LAB_ASSETS||{},C.makeHeroSprites());
  let renderer;try{await L.loadAssets();renderer=L.createRenderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent='WebGL2 を開始できません: '+e.message;return;}
  // ---------- run state ----------
  const G={state:'select',cls:'slasher',seed:1,t:0,hero:null,boss:null,form:null,formIndex:0,forms:[],slow:0,after:0,actions:new Map(),stats:null,later:[],bolts:[],pops:[],history:[],headless:false,bot:null,bossDown:false,finaleT:0};
  C.state=G;
  C.later=(dt,fn)=>G.later.push({at:G.t+dt,fn});
  C.bolt=(a,e)=>G.bolts.push({a:{...a},b:{x:e.x,y:e.y},life:.14,seed:L.random()*1000});
  C.denied=h=>{C.sfx('deny',h);return false;};
  C.locked=e=>!!(G.boss&&C.bossLocked(G.boss,e));
  C.deflect=(h,e,a,b)=>{h.dash=null;const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;h.recoil=.14;h.vx=-dx/l*520;h.vy=-dy/l*520;W.freeze=Math.max(W.freeze,.05);C.sfx('clink',e);W.rings.push({x:e.x,y:e.y,r0:e.radius,r1:e.radius*1.5,life:.15,total:.15,w:4,color:[1,1,1]});};
  C.newAction=h=>{if(G.form&&!G.form.cleared)G.form.actions++;G.actions.set(h.action,{id:h.action,cls:G.cls,kills:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,form:G.form?G.form.def.id:'boss',reported:false});G.stats.actions++;};
  C.markAction=()=>{};
  // Every break goes through here: delayed, idempotent, boss layers and multi-hit core.
  C.hit=(e,fn,h,delay=0,gen=0)=>{const run=()=>{if(e.removed||e.active||!W.bodies.includes(e))return;
      if(e.bossPart&&e.hp>1){e.hp--;e.squash=1;e.pressing={age:0,duration:.18,done:()=>{}};L.events.emit('strain',{material:e.material,amount:.8,rate:3,x:e.x});C.sfx('pound',e);W.rings.push({x:e.x,y:e.y,r0:e.radius*.8,r1:e.radius*1.25,life:.2,total:.2,w:5,color:[1,.9,1]});return;}
      e.chainGen=gen;fn();};
    if(delay>0)C.later(delay,run);else run();};
  W.onBreak=(b,opt)=>{G.stats.kills++;const a=G.actions.get(opt.action);if(a){a.kills++;a.last=G.t;const gen=b.chainGen||0;if(gen>0){a.chainKills++;a.chainMax=Math.max(a.chainMax,gen);G.stats.chainKills++;}}
    G.stats.byMaterial[b.material]=(G.stats.byMaterial[b.material]||0)+1;
    if(G.boss&&b.id===G.boss.core.id)bigBreak();};

  // ---------- flow ----------
  function start(cls=G.cls,seed=G.seed){
    // reset every clock/id the run depends on (a stale L.time froze formation ages on retry)
    W.clear();L.seed(seed);L.time=0;L.frame=0;W.nextId=1;W.cutId=0;G.cls=cls;G.seed=seed;G.t=0;G.hero=C.createHero(cls);G.boss=null;G.form=null;G.formIndex=0;G.forms=[];G.slow=0;G.after=0;G.actions=new Map();G.later=[];G.bolts=[];G.pops=[];C.wells=[];G.bossDown=false;G.finaleT=0;
    G.stats={cls,seed,kills:0,actions:0,chainKills:0,best:0,bestChain:0,perfect:0,formsSeen:0,byMaterial:{},bossTime:null,bossDefeated:false,perAction:[]};
    G.state='play';if(!G.headless){$('select').hidden=true;$('result').hidden=true;$('hud').hidden=false;$('cls').textContent=CLASSES[cls].name+' '+CLASSES[cls].jp;$('mana').hidden=cls!=='caster';showHelp();}
    nextFormation();
  }
  function nextFormation(){const lap=Math.floor(G.formIndex/C.FORMATIONS.length),f=C.FORMATIONS[G.formIndex++%C.FORMATIONS.length];G.form=C.spawnFormation(f,G.hero,16+lap*10);G.form.lap=lap;G.forms.push(G.form);G.stats.formsSeen++;banner(f.name+(lap?' ×'+(lap+1):''),f.hint,f.par);}
  function formAlive(f){return f.ids.filter(id=>W.bodies.some(b=>b.id===id&&!b.active&&!b.removed)).length;}
  function updateFlow(dt){
    if(G.state!=='play')return;
    if(!G.boss){const f=G.form;if(f){const alive=formAlive(f),age=G.t-f.start;
        if(alive<=Math.ceil(f.total*.15)||age>9){if(G.t<30)nextFormation();else startBoss();}}}
    // a formation counts as cleared whenever its last member breaks (stragglers included)
    for(const f of G.forms)if(!f.cleared&&formAlive(f)===0){f.cleared=true;if(f.actions<=f.def.par){G.stats.perfect++;pop(G.hero.x,G.hero.y-120,'PERFECT','perfect');C.sfx('perfect');}}
    if(G.boss&&!G.bossDown){rotateBoss(dt);if(G.t>56)bigBreak(true);}
    if(G.bossDown){G.finaleT+=dt;if(G.finaleT>4.2)finish();}
  }
  function startBoss(){if(G.boss)return;G.form=null;G.boss=C.spawnBoss();G.stats.bossTime=G.t;banner('巨大素材ボス','外殻 → 中層 → 核。外側からしか壊れない。',null);
    for(const b of W.enemies())if(!b.bossPart)b.drift={x:0,y:60};}
  function rotateBoss(dt){const B=G.boss;B.rot=(B.rot||0)+dt*.22;const by=B.cy+Math.sin(G.t*1.3)*8;
    for(const b of W.bodies){if(!b.bossPart||b.active||b.flying||b.removed)continue;if(b.orbit){b.x=B.cx+Math.cos(b.orbit.a+B.rot)*b.orbit.d;b.y=by+Math.sin(b.orbit.a+B.rot)*b.orbit.d;b.angle=B.rot;}else{b.x=B.cx;b.y=by;}b.dirty=true;}}
  // 大規模破壊: the core goes, the whole field collapses outward in a wave, in slow motion.
  function bigBreak(timeUp=false){if(G.bossDown)return;G.bossDown=true;G.stats.bossDefeated=!timeUp;G.slow=timeUp?.4:.9;C.sfx('finale');
    const B=G.boss,list=W.enemies().map(e=>({e,d:Math.hypot(e.x-B.cx,e.y-B.cy)})).sort((a,b)=>a.d-b.d),id=-1;G.actions.set(id,{id,kills:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,system:true,reported:true});
    list.forEach(({e,d},i)=>C.hit(e,()=>{const dx=e.x-B.cx,dy=e.y-B.cy,l=Math.hypot(dx,dy)||1;W.shatter(e,1600,{push:{x:dx/l*(300+Math.random()*200),y:dy/l*(300+Math.random()*200)-120},action:id,cause:'finale',stop:.008});},{action:id},.08+d/900*.5+i*.004));
    W.rings.push({x:B.cx,y:B.cy,r0:40,r1:700,life:.9,total:.9,w:10,color:[1,.95,.85],alpha:.55});
    pop(360,380,timeUp?'TIME UP':'BREAK!!','big');}
  function finish(){G.state='result';const s=G.stats;for(const a of G.actions.values()){if(a.system)continue;s.best=Math.max(s.best,a.kills);s.bestChain=Math.max(s.bestChain,a.chainMax);s.perAction.push(a.kills);}
    G.history.push({...s});if(!G.headless)showResult();}

  // ---------- simulation step ----------
  function step(dt){
    if(G.state!=='play')return;
    const scale=G.slow>0?.3:1;G.slow=Math.max(0,G.slow-dt);const sdt=dt*scale;G.t+=sdt;L.time=G.t;L.frame++;
    for(let i=G.later.length-1;i>=0;i--)if(G.later[i].at<=G.t){const q=G.later.splice(i,1)[0];q.fn();}
    C.updateHero(G.hero,sdt);C.updateWells(sdt);W.advance(sdt);
    if(W.freeze>0)W.freeze=Math.max(0,W.freeze-dt);else{W.physics(sdt);C.updateProjectiles(sdt);}
    W.decay(sdt);for(const b of G.bolts)b.life-=sdt;G.bolts=G.bolts.filter(b=>b.life>0);
    // action reports ("12 KO") once an action has settled
    for(const a of G.actions.values())if(!a.system&&!a.reported&&G.t-a.last>.45&&G.t-a.t0>.3){a.reported=true;G.stats.best=Math.max(G.stats.best,a.kills);if(a.kills>=3&&!G.headless){pop(G.hero.x,G.hero.y-90,a.kills+' KO'+(a.chainMax?' · 連鎖'+a.chainKills:''),a.kills>=12?'big':'ko');C.sfx('ko',{n:a.kills});}}
    updateFlow(dt);if(G.bot)G.bot(dt);
  }

  // ---------- input grammar ----------
  let ptr=null;const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.x)*720/r.width,y:(e.clientY-r.y)*1280/r.height};};
  canvas.addEventListener('pointerdown',e=>{if(G.state!=='play')return;L.audio?.init?.();canvas.setPointerCapture(e.pointerId);const p=point(e);ptr={id:e.pointerId,start:p,pts:[p],t0:performance.now(),dist:0,aim:false};e.preventDefault();});
  canvas.addEventListener('pointermove',e=>{if(!ptr||e.pointerId!==ptr.id)return;const p=point(e),last=ptr.pts[ptr.pts.length-1];ptr.dist+=Math.hypot(p.x-last.x,p.y-last.y);ptr.pts.push(p);
    if(!ptr.aim&&performance.now()-ptr.t0>170&&Math.hypot(ptr.pts[Math.min(3,ptr.pts.length-1)].x-ptr.start.x,ptr.pts[Math.min(3,ptr.pts.length-1)].y-ptr.start.y)<14)ptr.aim=true;
    if(ptr.aim)G.hero.aim={x:p.x-ptr.start.x,y:p.y-ptr.start.y};});
  setInterval(()=>{if(ptr&&!ptr.aim&&ptr.dist<14&&performance.now()-ptr.t0>200){ptr.aim=true;G.hero.aim={x:0,y:0};}},40);
  function up(e,cancel){if(!ptr||e.pointerId!==ptr.id)return;const p=ptr,h=G.hero;ptr=null;h.aim=null;if(cancel||G.state!=='play')return;
    if(p.aim){const end=p.pts[p.pts.length-1];C.release(h,{x:end.x-p.start.x,y:end.y-p.start.y});return;}
    if(p.dist<16){C.tap(h);return;}
    const rel=L.slice.resample(p.pts,10).map(q=>({x:q.x-p.start.x,y:q.y-p.start.y}));C.flick(h,rel);}
  canvas.addEventListener('pointerup',e=>up(e,false));canvas.addEventListener('pointercancel',e=>up(e,true));

  // ---------- render ----------
  function heroQuad(h){const k=h.dash?1.12:1,s=100*k,flip=Math.cos(h.face)<0?-1:1,bob=h.dash?0:Math.sin(h.bob*4)*4,sp=h.spin>0?(h.spin-=1/60,G.t*40):0;
    const c=Math.cos(sp),si=Math.sin(sp),P=(x,y)=>({x:h.x+(x*c-y*si),y:h.y+bob+(x*si+y*c)});const a=P(-s,-s),b=P(s,-s),cc=P(s,s),d=P(-s,s);
    return [{...a,u:flip>0?0:1,v:0},{...b,u:flip>0?1:0,v:0},{...cc,u:flip>0?1:0,v:1},{...d,u:flip>0?0:1,v:1}];}
  function draw(){
    renderer.begin();
    renderer.line({x:20,y:L.FLOOR+2},{x:700,y:L.FLOOR+2},1,[.5,.6,.8,.25]);
    W.drawBodies(renderer);
    for(const w of C.wells){const k=Math.min(1,w.t/w.pull);let prev=null;for(let i=0;i<=36;i++){const a=i/36*6.283+G.t*3,rr=w.core*(1.1-k*.4),p={x:w.x+Math.cos(a)*rr,y:w.y+Math.sin(a)*rr};if(prev)renderer.flash(prev,p,4,[.75,.6,1,.6]);prev=p;}renderer.glow(w.x,w.y,40+k*40,[.6,.4,1,.5]);}
    for(const b of G.bolts){let prev=b.a;for(let i=1;i<=6;i++){const t=i/6,j=i<6?(Math.sin(b.seed+i*9.1)*14):0,p={x:b.a.x+(b.b.x-b.a.x)*t+j,y:b.a.y+(b.b.y-b.a.y)*t-j};renderer.flash(prev,p,4,[.75,.95,1,b.life/.14]);renderer.flash(prev,p,1.5,[1,1,1,1]);prev=p;}}
    const h=G.hero;if(h){if(h.aim){const pv=C.aimPreview(h,h.aim);if(pv&&pv.kind==='line'){renderer.flash(pv.a,pv.b,3+pv.power*4,[1,.95,.7,.55]);}else if(pv&&pv.kind==='well'){let prev=null;for(let i=0;i<=40;i++){const a=i/40*6.283,p={x:pv.p.x+Math.cos(a)*pv.core,y:pv.p.y+Math.sin(a)*pv.core};if(prev)renderer.flash(prev,p,2,[.8,.7,1,.7]);prev=p;}}
        const pull=Math.min(1,Math.hypot(h.aim.x,h.aim.y)/160);renderer.glow(h.x,h.y,50+pull*40,h.cls==='caster'?[.6,.5,1,.45]:h.cls==='crusher'?[1,.6,.3,.45]:[.6,.85,1,.45]);}
      renderer.glow(h.x,h.y+70,60,[0,0,0,.35]);renderer.glow(h.x,h.y,70,h.cls==='caster'?[.5,.4,1,.18]:h.cls==='crusher'?[1,.5,.3,.18]:[.4,.7,1,.18]);
      renderer.mesh('hero/'+h.cls,heroQuad(h),[0,1,2,0,2,3]);}
    W.drawFx(renderer);renderer.render(W.particles,G.t,W.punch,G.slow>0);
  }
  // ---------- HUD ----------
  const popsEl=$('pops');
  function pop(x,y,text,kind){if(G.headless)return;const d=document.createElement('div');d.className='pop '+(kind||'');d.textContent=text;const r=canvas.getBoundingClientRect();d.style.left=(x/720*100)+'%';d.style.top=(y/1280*100)+'%';popsEl.appendChild(d);setTimeout(()=>d.remove(),1100);}
  function banner(name,hint,par){if(G.headless)return;$('banner').innerHTML=`<b>${name}</b><span>${hint}</span>`+(par?`<i>目安 ${par} 手</i>`:'');$('banner').classList.remove('show');void $('banner').offsetWidth;$('banner').classList.add('show');}
  function showHelp(){const c=CLASSES[G.cls];$('help').innerHTML=`<span>${c.flick}</span><span>${c.hold}</span><span>${c.tap}</span>`;}
  function hud(){if(G.state!=='play')return;$('time').style.width=Math.max(0,100-G.t/60*100)+'%';$('kills').textContent=G.stats.kills;const h=G.hero;if(h.cls==='caster')$('mana').innerHTML='◆'.repeat(h.mana)+'<em>'+'◇'.repeat(h.manaMax-h.mana)+'</em>';}
  function showResult(){const s=G.stats;$('hud').hidden=true;$('result').hidden=false;
    $('r-title').textContent=s.bossDefeated?'すっきり！':'おつかれさま';
    $('r-stats').innerHTML=`<div><small>撃破</small><b>${s.kills}</b></div><div><small>一手の最大</small><b>${s.best}</b></div><div><small>連鎖撃破</small><b>${s.chainKills}</b></div><div><small>PERFECT</small><b>${s.perfect}/${s.formsSeen}</b></div><div><small>手数</small><b>${s.actions}</b></div><div><small>一手あたり</small><b>${(s.kills/Math.max(1,s.actions)).toFixed(1)}</b></div>`;
    const same=G.history.filter(r=>r.seed===G.seed);$('r-compare').innerHTML=same.length>1?'<p>同じ戦場での比較</p>'+same.map(r=>`<div>${CLASSES[r.cls].name}<span>${r.kills} 撃破 · 最大 ${r.best} · 連鎖 ${r.chainKills}</span></div>`).join(''):'';}
  for(const k of Object.keys(CLASSES)){$('pick-'+k).onclick=()=>{L.audio?.init?.();start(k,G.seed);};$('again-'+k).onclick=()=>{L.audio?.init?.();start(k,G.seed);};}
  $('again').onclick=()=>{L.audio?.init?.();start(G.cls,G.seed);};$('newfield').onclick=()=>{L.audio?.init?.();start(G.cls,(G.seed*7919+13)%100000);};
  $('mute').onclick=()=>{C.muted=!C.muted;L.audio?.setEnabled?.(!C.muted);$('mute').textContent=C.muted?'🔇':'🔊';};

  // ---------- loop ----------
  let prev=0;function frame(ms){const dt=prev?Math.min(.05,(ms-prev)/1000):1/60;prev=ms;const t0=performance.now();step(dt);if(G.state!=='select')draw();hud();C.frameMs=performance.now()-t0;requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  // ---------- bots (AI objective verification) ----------
  function enemiesNow(){return W.enemies().filter(e=>!C.locked(e));}
  function relLine(h,tx,ty,k){return [{x:0,y:0},{x:(tx-h.x)/k,y:(ty-h.y)/k}];}
  function scoreSeg(a,b,reach,charged){let n=0;for(const e of enemiesNow()){if(!charged&&C.MAT[e.material].armor&&e.hp>1)continue;if(C.segDist(e,a,b)<=e.radius+reach)n++;}return n;}
  function rayCount(o,u,len,skip){let n=0;for(const e of enemiesNow()){if(e===skip)continue;const b={x:o.x+u.x*len,y:o.y+u.y*len};if(C.segDist(e,o,b)<e.radius*.85+30)n++;}return n;}
  function makeBot(skill){let cd=0;const rng=(()=>{let s=G.seed*977+skill.length;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);})();
    return dt=>{cd-=dt;const h=G.hero;if(cd>0||h.dash||G.state!=='play')return;cd=skill==='random'?.45:.55;const en=enemiesNow();if(!en.length)return;
      if(skill==='random'){const r=rng(),a=rng()*6.283,l=120+rng()*200;if(r<.6)C.flick(h,[{x:0,y:0},{x:Math.cos(a)*l,y:Math.sin(a)*l}]);else if(r<.85)C.tap(h);else C.release(h,{x:Math.cos(a)*120,y:Math.sin(a)*120});return;}
      const near=en.reduce((b,e)=>Math.hypot(e.x-h.x,e.y-h.y)<Math.hypot(b.x-h.x,b.y-h.y)?e:b);
      if(skill==='naive'){if(h.cls==='caster'&&h.mana>=2&&Math.hypot(near.x-h.x,near.y-h.y)<540){C.tap(h);return;}const k=h.cls==='caster'?1.2:1.65,d=Math.hypot(near.x-h.x,near.y-h.y)||1;C.flick(h,relLine(h,near.x+(near.x-h.x)/d*60,near.y+(near.y-h.y)/d*60,k));return;}
      // skilled: evaluate candidate actions, pick the one predicted to break the most
      let best={score:-1};
      if(h.cls==='slasher'){for(let i=0;i<36;i++){const a=i/36*6.283;for(const L1 of [260,420,560]){const b=C.clampP({x:h.x+Math.cos(a)*L1,y:h.y+Math.sin(a)*L1});const s=scoreSeg(h,b,42,false);if(s>best.score)best={score:s,act:()=>C.flick(h,relLine(h,b.x,b.y,1.5))};}
          for(const p of [1]){const reach=520+p*360,b=C.clampP({x:h.x+Math.cos(a)*reach,y:h.y+Math.sin(a)*reach}),s=scoreSeg(h,b,58,true)-.5;if(s>best.score)best={score:s,act:()=>C.release(h,{x:-Math.cos(a)*160*p,y:-Math.sin(a)*160*p})};}}
        const sp=en.filter(e=>Math.hypot(e.x-h.x,e.y-h.y)<170&&!(C.MAT[e.material].armor&&e.hp>1)).length;if(sp>best.score)best={score:sp,act:()=>C.tap(h)};}
      else if(h.cls==='crusher'){for(const e of en){const d=Math.hypot(e.x-h.x,e.y-h.y);if(d>620)continue;const u={x:(e.x-h.x)/d,y:(e.y-h.y)/d};const blocked=en.some(o=>o!==e&&C.segDist(o,h,e)<o.radius+30&&Math.hypot(o.x-h.x,o.y-h.y)<d);if(blocked)continue;
          const cap=2.05*(.6+C.MAT[e.material].hard*.5)/.55,n=Math.min(rayCount(e,u,900,e),cap)+1;if(n>best.score)best={score:n,act:()=>C.flick(h,relLine(h,e.x+u.x*40,e.y+u.y*40,1.65))};
          const capC=3.8*(.6+C.MAT[e.material].hard*.5)/.55,nc=Math.min(rayCount(e,u,1100,e),capC)+1-.6;if(nc>best.score&&d<380)best={score:nc,act:()=>C.release(h,{x:-u.x*160,y:-u.y*160})};}
        const pd=en.filter(e=>Math.hypot(e.x-h.x,e.y-h.y)<180).length;if(pd>best.score)best={score:pd,act:()=>C.tap(h)};
        if(best.score<2){best={score:1,act:()=>{const d=Math.hypot(near.x-h.x,near.y-h.y)||1;C.flick(h,relLine(h,near.x,near.y+40,1.65));}};}}
      else{ // caster: chain size from the nearest target, gravity well on the densest spot, glide to set up
        const first=near,vis=new Set([first.id]),q=[first];while(q.length){const c=q.shift();if(!C.MAT[c.material].wet)continue;for(const o of en)if(!vis.has(o.id)&&Math.hypot(o.x-c.x,o.y-c.y)<o.radius+c.radius+115){vis.add(o.id);q.push(o);}}
        if(h.mana>=2&&Math.hypot(first.x-h.x,first.y-h.y)<560&&(vis.size>=3||h.mana>=h.manaMax))best={score:vis.size,act:()=>C.tap(h)}; // skilled: save mana unless the bolt will travel
        if(h.mana>=4){for(const c of (G.boss&&!G.bossDown?[...en,{x:G.boss.cx,y:G.boss.cy}]:en)){const n=en.filter(e=>Math.hypot(e.x-c.x,e.y-c.y)<(e.bossPart?240:260)).length;const d=Math.hypot(c.x-h.x,c.y-h.y);if(d>560||n*.8<=best.score+1)continue;const u={x:(c.x-h.x)/(d||1),y:(c.y-h.y)/(d||1)},pw=Math.max(0,Math.min(1,(d-120)/440));best={score:n*.8,act:()=>C.release(h,{x:-u.x*160*pw-u.x*.01,y:-u.y*160*pw-u.y*.01})};}}
        if(best.score<3){let bc=null,bn=0;for(const c of en){if(!C.MAT[c.material].wet)continue;const s=new Set([c.id]),qq=[c];while(qq.length){const x=qq.shift();for(const o of en)if(!s.has(o.id)&&C.MAT[o.material].wet&&Math.hypot(o.x-x.x,o.y-x.y)<o.radius+x.radius+115){s.add(o.id);qq.push(o);}}if(s.size>bn){bn=s.size;bc=c;}}
          if(bc&&bn>best.score+1){best={score:bn,act:()=>C.flick(h,relLine(h,bc.x,bc.y+150,1.2))};}}
        if(G.boss&&!G.bossDown&&Math.hypot(G.boss.cx-h.x,G.boss.cy-h.y)>560&&best.score<4)best={score:3,act:()=>C.flick(h,relLine(h,G.boss.cx,G.boss.cy+330,1.2))};
        if(best.score<0)best={score:0,act:()=>C.flick(h,relLine(h,near.x,near.y+160,1.2))};}
      best.act&&best.act();};}

  window.COMBAT={
    state:G,start,
    test:{
      // Headless deterministic run: no rendering, fixed 60 Hz steps, a bot plays. Returns the metrics.
      simulate(cls,seed,skill,seconds=70){G.headless=true;start(cls,seed);G.bot=makeBot(skill);let n=0;while(G.state==='play'&&n<seconds*60){step(1/60);n++;}const s={...G.stats,perAction:undefined,forms:G.forms.map(f=>({id:f.def.id,actions:f.actions,cleared:f.cleared,total:f.total,left:formAlive(f)})),seconds:n/60,state:G.state,skill};
        for(const a of G.actions.values()){if(a.system)continue;s.best=Math.max(s.best,a.kills);s.bestChain=Math.max(s.bestChain,a.chainMax);}s.finaleKills=G.actions.get(-1)?.kills||0;G.bot=null;G.headless=false;G.state='select';W.clear();return s;},
      play(cls,seed,skill){start(cls,seed);G.bot=skill?makeBot(skill):null;},
      bossOnly(cls,skill,seconds=40){G.headless=true;start(cls,1);W.clear();G.form=null;G.forms=[];G.t=31;startBoss();G.bot=skill?makeBot(skill):null;let n=0;while(G.state==='play'&&!G.bossDown&&n<seconds*60){step(1/60);n++;}const r={down:G.bossDown,secs:n/60,layers:G.boss.layers.map(l=>l.filter(id=>W.bodies.some(b=>b.id===id&&!b.active&&!b.removed)).length),coreHp:G.boss.core.hp,actions:G.stats.actions};G.bot=null;G.headless=false;G.state='select';W.clear();return r;},
      step,draw,
      shot(){draw();return true;},
      hero:()=>G.hero,C,
    }
  };
  $('loading').hidden=true;$('select').hidden=false;
})(window.LAB);
