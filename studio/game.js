/* CRUNCH STUDIO runtime, based on the independent v0.8 FLOW research page. */
(async function(L){
  'use strict';
  const C=L.combat,W=L.world,K=C.crunch,$=id=>document.getElementById(id),canvas=$('scene');
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const Studio=window.StudioContent, Stages=C.stages, CLASSES=Studio.heroes;
  const progress=Studio.load(), testing=new URLSearchParams(location.search).get('test')==='1';
  Stages.patchEngine();
  K.POWER=[1,3,5,7];K.power=h=>K.POWER[Math.min(3,h.ups.size)]; // v0.8: up to three level-ups
  L.config.maxBodies=230;L.config.maxDepth=6;
  C.MAT.chalk.armor=false;          // every hit goes through the same damage path (chips), no special armour rule
  const art=window.LAB_ASSETS=window.LAB_ASSETS||{};
  Object.assign(art,C.makeHeroSprites());
  for(const stage of Studio.stages) art['bg/'+stage.mat]=Studio.background(stage);
  Object.assign(art,window.StudioBattleArt);
  let renderer;
  try { await L.loadAssets(); renderer=L.createRenderer(canvas); }
  catch(e) { $('loading').hidden=true; $('error').hidden=false; $('error').textContent='WebGL2 を開始できません: '+e.message; return; }
  // light stage: deepen near-white effect strokes, soften additive glows
  {const f=renderer.flash.bind(renderer),rb=renderer.ribbon.bind(renderer),gl=renderer.glow.bind(renderer);
    renderer.flash=(a,b,w,col)=>f(a,b,w,K.ink(col));renderer.ribbon=(a,b,w,col)=>rb(a,b,w,K.ink(col));renderer.glow=(x,y,r,col)=>gl(x,y,r,[col[0],col[1],col[2],(col[3]??1)*.45]);}

  // ---------- run state ----------
  const G={state:'select',cls:'slasher',seed:1,t:0,rt:0,hero:null,boss:null,slow:0,actions:new Map(),stats:null,later:[],bolts:[],glows:[],arcs:[],bossDown:false,finaleT:0,paused:false,choice:null,broken:new Map(),gestureT:0,sched:null,lineFlash:0,breakT:0};
  C.state=G;
  C.later=(dt,fn)=>G.later.push({at:G.t+dt,fn});
  C.bolt=(a,e)=>G.bolts.push({a:{x:a.x,y:a.y},b:{x:e.x,y:e.y},life:.14,seed:L.random()*1000});
  const LVCOL=[null,[1,.42,.72],[1,.72,.25]];
  C.blade=(pts,ws,col)=>{const lv=G.hero?G.hero.ups.size:0;let c=col;if(G.hero&&G.hero.cls!=='spinner'){if(lv>=3){const h=G.t*2;c=[.6+.4*Math.sin(h),.6+.4*Math.sin(h+2.1),.6+.4*Math.sin(h+4.2)];}else if(lv)c=LVCOL[lv];}G.arcs.push({pts,ws:lv?ws.map(w=>w*(1+lv*.12)):ws,col:c,life:.34,total:.34});};
  C.glow=(p,r,col)=>G.glows.push({x:p.x,y:p.y,r,col,life:.25,total:.25});
  C.touch=id=>{const a=G.actions.get(id);if(a&&a.firstHit==null)a.firstHit=G.rt;};
  C.locked=e=>!!(G.boss&&C.bossLocked(G.boss,e));
  C.begin=(h,kind,info={})=>{h.action++;h.lastKind=kind;h.idle=0;G.actions.set(h.action,{id:h.action,kind,cls:G.cls,kills:0,hurts:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,level:h.ups.size,inputT:G.gestureT,fireT:G.rt,firstBreak:null,reported:false,info,phase:phaseAt(G.t)});G.stats.actions++;if(G.stats.firstActionT==null)G.stats.firstActionT=G.t;};
  C.sfxGain=.75; // hero sounds a little behind the materials (v0.6 finding)
  // Every hit goes through here. Not enough damage → chip (visible + audible), enough → the hero's own break (cut/shatter).
  C.hit=(e,fn,h,delay=0,gen=0)=>{const run=()=>{if(e.removed||e.active||!W.bodies.includes(e))return;if(G.breaks>=5){C.later(.001,run);return;}G.breaks++;
      const aid=h&&h.action!=null?h.action:G.hero.action,act=G.actions.get(aid);
      if(e.bossPart&&e.hp>(h?.bossDmg||1)){C.touch(G.hero.action);e.hp=Math.max(1,e.hp-(h?.bossDmg||1));e.squash=1;e.pressing={age:0,duration:.18,done:()=>{}};K.bossChip(e);if(act)act.hurts++;
        L.events.emit('impact',{material:e.material,speed:900,area:Math.min(e.area,5000),x:e.x,y:e.y});L.events.emit('crumble',{material:e.material,count:4,x:e.x,y:e.y});
        const g=C.sfxGain;C.sfxGain=g*.3;C.sfx('pound',e);C.sfxGain=g;W.rings.push({x:e.x,y:e.y,r0:e.radius*.8,r1:e.radius*1.25,life:.2,total:.2,w:5,color:[1,.6,.8]});G.stats.bossHits++;return;}
      if(!e.bossPart&&e.hpc>0){const dmg=(h&&h.dmg)||K.power(G.hero);if(e.hpc>dmg){C.touch(aid);K.hurt(e,dmg,G.hero);G.stats.hurts++;if(act)act.hurts++;return;}e.hits++;}
      e.chainGen=gen;fn();};
    if(delay>0)C.later(delay,run);else run();};
  // CRUSHER: a punch that does not break chips the enemy and knocks it back into the crowd behind it.
  C.onPunch=(h,id,e,ux,uy,o)=>{const dmg=K.power(h)*1.5;if(e.hpc>dmg){const core=K.hurt(e,dmg,h);G.stats.hurts++;const a=G.actions.get(id);if(a)a.hurts++;
      /* TEMPO: a short nudge back (≈30 px, ≈60 with ぶっ飛ばし), no flight — the next punch still lands on it */const nd=o.blast?60:30;core.nudge={x:ux*nd,y:uy*nd,t:.12};core.squash=1;core.pushedBy=id;return true;}
    // finishing punch: the enemy bursts where it stands and its shards fly on into the crowd behind (no launch:
    // with the crowd above and nothing to stop it, a launched enemy bounced off the top and fell through the line)
    e.hpc=0;e.hits++;
    if(C.rayCount(e,{x:ux,y:uy},900,e)>=2)return false; /* a crowd behind: v0.5 billiards (launch); it can no longer fall back through the line, see dropLaunched */
    C.hit(e,()=>W.shatter(e,2200,{angle:Math.atan2(uy,ux)+Math.PI/2,push:{x:ux*680,y:uy*680},projectile:1.6*(o.blast?1.5:1),owner:id,action:id,cause:'punch',stop:o.fin?.03:.016}),h);return true;};
  // A body chipped many times can become a polygon the triangulator rejects (seen with jelly). Never let one hit
  // stop the game: if a cut throws, the enemy crumbles into particles and still counts as broken.
  {const cut=W.cut;W.cut=(body,path,speed,opt={})=>{try{return cut(body,path,speed,opt);}catch(err){if(!W.bodies.includes(body)||body.removed)return null;
      const d0=body.depth;body.removed=true;G.stats.cutErrors=(G.stats.cutErrors||0)+1;for(let i=0;i<16;i++)L.addParticle({x:body.x,y:body.y,vx:(L.random()-.5)*420,vy:-L.random()*360,size:4+L.random()*5,life:.6,color:K.matColor(body.material),floor:true});
      L.events.emit('crumble',{material:body.material,count:10,x:body.x,y:body.y});if(!d0&&W.onBreak)W.onBreak(body,opt);return [];}};}
  {const hurt=K.hurt;K.hurt=(e,d,f,o)=>{const uid=e.uid??e.id,a0=e.area,core=hurt(e,d,f,o);core.uid=uid;C.sfx('crack',{x:core.x,stage:core.hits});
    // CRUNCH ENERGY for a chip = what actually came off (relative to the enemy's first size) x its size: no farming by hitting air or a crumb
    const removed=Math.max(0,a0-core.area)/(e.area0||a0);C.studioChip(core,removed*ENERGY.chip*Math.sqrt((e.area0||a0)/12000));return core;};}
  K.bossChip=e=>{const P=e.poly;if(!P||!e.cracks)e.cracks=[];const a=L.random()*6.28,r=e.radius*.6,p0={x:Math.cos(a)*r*.2,y:Math.sin(a)*r*.2},pts=[p0];let p=p0,ang=a;for(let k=0;k<3;k++){ang+=(L.random()-.5)*.8;p={x:p.x+Math.cos(ang)*r*.3,y:p.y+Math.sin(ang)*r*.3};pts.push(p);}e.cracks.push(pts);if(e.cracks.length>6)e.cracks.shift();
    for(let i=0;i<5;i++)L.addParticle({x:e.x,y:e.y,vx:(L.random()-.5)*300,vy:-L.random()*260,size:3+L.random()*5,life:.5,color:K.matColor(e.material),floor:true});};
  W.onBreak=(b,opt)=>{const s=G.stats;s.kills++;if(s.firstKillT==null)s.firstKillT=G.t;G.broken.set(b.id,G.t);
    const a=G.actions.get(opt.action);if(a){a.kills++;a.last=G.t;if(a.firstBreak==null)a.firstBreak=G.rt;const gen=b.chainGen||0;if(gen>0){a.chainKills++;a.chainMax=Math.max(a.chainMax,gen);s.chainKills++;}}
    s.byMaterial[b.material]=(s.byMaterial[b.material]||0)+1;if(b.bossPart)G.stats.bossHits++;
    if(b.kind&&opt.cause!=='finale'){const lv=G.hero.ups.size,k=s.byKind[b.kind]=s.byKind[b.kind]||[[],[],[],[]];k[lv].push(b.hits||1);s.lifeOf.push({kind:b.kind,life:G.t-b.born,hits:b.hits||1,t:G.t});}
    if(opt.cause!=='finale'){gain(b.bossPart?ENERGY.boss:(ENERGY.kill[b.kind]??.6),'kill');spark(b);}
    if(G.boss&&b.id===G.boss.core.id)bigBreak();};

  // ---------- flow (60 s) ----------
  const BOSS_T=40;
  const phaseAt=()=>G.boss?'boss':['one','grow','horde','horde'][Math.min(3,G.hero.ups.size)];
  // ---------- B. CRUNCH ENERGY ----------
  // Needs per level (from the previous level). Kills give energy by enemy size; chips by the area they remove;
  // a big single attack (>=6 kills) adds a bonus (capped). A player who lags behind the usual pace gets a growing
  // multiplier (catch-up), so the weak phase never drags on.
  const ENERGY={need:[43,140,265],chip:8,kill:{weak:10,mid:3.2,swarm:1.0,hard:18},boss:2,bigHit:.12,bigCap:12,pace:[12,24,34]};
  function gain(v,src){if(!G.stats||G.state!=='play'||G.free||v<=0)return;const lv=G.hero.ups.size;if(lv>=3){G.energyOver=(G.energyOver||0)+v;return;}
    const late=Math.max(0,G.t-ENERGY.pace[lv]),mult=1+Math.min(3,late/4);G.energy+=v*mult;G.stats.energy[src]=(G.stats.energy[src]||0)+v*mult;G.gainFlash=.3;
    if(G.energy>=ENERGY.need[lv]&&!G.paused&&!G.levelPending){G.levelPending=true;C.later(.05,()=>{G.levelPending=false;if(G.hero.ups.size<3&&G.energy>=ENERGY.need[G.hero.ups.size])levelUp();});}}
  // Material flakes stay physical. A few bright fragments peel off toward the energy meter.
  function spark(body) {
    if(G.free||G.hero.ups.size>=3||G.sparks.length>=42)return;
    G.sparks.push({x:body.x,y:body.y,age:0,color:K.matColor(body.material)});
  }
  C.studioChip=(body,value)=>{gain(value,'chip');if(value>0)spark(body);};
  function levelUp(){const lv=G.hero.ups.size;G.energy-=ENERGY.need[lv];G.stats.levelUps.push({lv:lv+1,t:+G.t.toFixed(2),kills:G.stats.kills,actions:G.stats.actions});offerUpgrade();}
  // ---------- A. the queue ----------
  // Enemies walk in from the top and WAIT in a visible queue (y < REACH). How many should be in reach depends on
  // the level; when reach runs short the queue steps forward faster. Enemies never overlap (a column waits behind
  // the enemy ahead), so materials and cracks stay readable. Spawning stays within a body budget.
  const REACH=400,QUEUE=188,WANT=[2,8,21,29],RESERVE=[2,5,14,20]; // waiting room y 150-400 (below the HUD), reach y 400-line
  function start(cls, stage, free=null) {
    P.cancel();
    const seed=(G.seed*7919+13)%100000;
    W.clear(); L.seed(seed); L.time=0; L.frame=0; W.nextId=1; W.cutId=0;
    Object.assign(G,{cls,stage,free,seed,t:0,rt:0,hero:C.createHero(cls),boss:null,slow:0,actions:new Map(),later:[],bolts:[],glows:[],arcs:[],sparks:[],bossDown:false,finaleT:0,paused:false,choice:null,broken:new Map(),gestureT:0,lineFlash:0,sampleT:0,
      sched:{spawn:0,hard:10,thin:0,firstHard:true,lane:0},energy:0,energyOver:0,levelPending:false,gainFlash:0,holdSupply:0});
    G.stats={cls,seed,kills:0,actions:0,hurts:0,chainKills:0,best:0,bestChain:0,ups:[],levelUps:[],energy:{},bossTime:null,bossSecs:null,bossDefeated:false,bossHits:0,firstActionT:null,firstKillT:null,byMaterial:{},byKind:{},lifeOf:[],breaches:[],onScreen:[],danger:[],byLevel:null,latency:null};
    G.state='play';
    Stages.applyRules(stage);
    C.mix=Stages.mixState(stage,0,false); C.sfxGain=(C.mix?.sfx??.7)*progress.volume/.65;
    ui.play();
    if(free) fillFree();
    else {
      K.spawn('weak',345,613,{m:stage.mat});
      K.spawn('weak',G.cls==='roller'?345:465,408,{m:stage.mat});
      K.spawn('weak',230,234,{m:stage.mat});
      banner(stage.name,Stages.MATERIALS[stage.mat].sound);
    }
  }

  function fillFree() {
    if(!G.free)return;
    P.cancel();
    W.clear(); G.later=[]; G.sparks=[]; G.arcs=[]; G.glows=[]; G.bolts=[];
    G.hero.launched=null;
    const positions=G.free==='single'?[[360,620]]:[[225,450],[495,450],[225,620],[495,620],[225,790],[495,790]];
    for(const [x,y] of positions) K.spawn(G.free==='single'?'weak':'mid',x,y,{m:G.stage.mat});
  }

  function addRow(kind, points) {
    const mix=kind==='weak'?[[G.stage.mat,1]]:Stages.mixAt(G.stage,G.t);
    const row=Stages.assign(points,mix,L.random);
    for(const p of row) K.spawn(kind,p.x,p.y,{m:p.m});
  }
  const alive=k=>{let n=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&(!k||b.kind===k))n++;return n;};
  function updateFlow(dt){
    if(G.state!=='play')return;
    dropLaunched(); pruneDebris();
    if(G.free){
      if(G.free==='supply'&&!alive()) {
        G.holdSupply+=dt;
        if(G.holdSupply>.65){G.holdSupply=0;fillFree();}
      }
      return;
    }
    tempoMotion(dt); K.march(dt,G,breach);
    C.mix=Stages.mixState(G.stage,G.t,!!G.boss);
    C.sfxGain=(C.mix?.sfx??.7)*progress.volume/.65;
    const S=G.sched,t=G.t;for(const k of ['spawn','hard','thin'])S[k]-=dt;const lv=Math.min(3,G.hero.ups.size);
    if(!G.boss){
      // keep a visible queue: if fewer than RESERVE[lv] are waiting above reach, bring the next row in from the top
      const waiting=W.bodies.filter(b=>!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&b.y<REACH).length,room=W.bodies.length<185&&alive()<72;
      if(room&&S.spawn<=0&&waiting<RESERVE[lv]){row(lv);S.spawn=lv===0?.9:lv===1?.7:.3;}
      if(lv>=2&&S.hard<=0&&alive('hard')<2&&room){const b=K.spawn('hard',150+L.random()*420,-90,{m:G.stage.mat});S.hard=lv>=3?4:6;if(b&&S.firstHard){S.firstHard=false;banner('厚い素材','断面が見えるまで何度か削る');}}
      if(t>=BOSS_T)startBoss();}
    else if(!G.bossDown){if(S.thin<=0&&alive()<12&&W.bodies.length<175){row(2,true);S.thin=2.5;}}
    if(G.boss&&!G.bossDown)moveBoss(dt);
    if(G.bossDown){G.finaleT+=dt;if(G.finaleT>2.25)finish();}
    else if(G.t>=60)finish();
    // sampling for the analysis (4 Hz)
    if((G.sampleT=(G.sampleT||0)-dt)<=0){G.sampleT=.25;let n=0,d=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&b.y>-20){n++;if(b.y>K.DANGER)d++;}G.stats.onScreen.push([+t.toFixed(2),n]);G.stats.danger.push([+t.toFixed(2),d]);}
  }
  // a launched enemy that turns downward (bounced off the top) breaks there instead of falling through the line
  function dropLaunched(){for(const p of W.bodies){if(p.removed||p.active||!p.flying||!p.proj||p.vy<=0||p.bossPart)continue;const own=p.proj.owner;p.proj=null;p.flying=false;C.hit(p,()=>W.shatter(p,1200,{action:own,cause:'chain-end',stop:.01}),{action:own});}}
  // debris budget: when the field is busy, pieces older than 1.4 s go first (they have fallen out of the action);
  // this frees room for more enemies in reach without more bodies on screen
  function pruneDebris(){if(W.bodies.length<=140)return;let n=0;for(const b of W.bodies){if(b.active&&b.age>1.4&&!b.dissolve){b.removed=true;n++;}}if(n){const keep=W.bodies.filter(b=>!b.removed);W.bodies.length=0;W.bodies.push(...keep);}}
  // one row of the queue, entering above the screen. Level 0: one big enemy in a free lane. Level 1: a row of 4-5.
  // Level 2+: a WIDE row across the whole field (so a big slash or spell always leaves something beside it).
  function row(lv,thin=false){
    const schedule=G.sched;
    if(lv===0){
      const lanes=G.cls==='roller'?[335,385,290,430]:[150,280,420,560];
      const x=lanes[schedule.lane++%4]+(L.random()-.5)*32;
      addRow('weak',[{x,y:-45}]); return;
    }
    const n=thin?5:lv===1?5:lv>=3?10:9;
    addRow(lv===1?'mid':'swarm',Array.from({length:n},(_,i)=>({
      x:70+i*(580/(n-1))+(L.random()-.5)*18,y:-45-i%2*38
    })));
  }
  function inReachN(){let n=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&!b.flying&&b.y>=REACH&&b.y<K.LINE)n++;return n;}
  // queue motion: nudges, the step-forward when reach runs short, and "wait behind the one ahead"
  function tempoMotion(dt){const lv=Math.min(3,G.hero.ups.size),inReach=inReachN(),short=Math.max(0,1-inReach/WANT[lv]),list=[];
    for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart)list.push(b);
    for(const b of list){if(b.base==null)b.base=b.speed;
      if(b.nudge){const k=Math.min(1,dt/b.nudge.t);b.x+=b.nudge.x*k;b.y+=b.nudge.y*k;b.nudge.t-=dt;b.dirty=true;if(b.nudge.t<=0)b.nudge=null;}
      // the queue (above reach) steps forward when reach runs short; enemies in reach keep their walking pace
      let sp=b.base*(b.y<REACH?1+3.5*short:1)+(b.y<REACH&&short>.5?60:0)+(b.y<QUEUE?90:0); /* nobody lingers under the HUD */
      // never walk into the enemy ahead: wait behind it (keeps every material visible, a column becomes a queue)
      for(const o of list){if(o===b||o.y<=b.y)continue;const rr=(o.radius+b.radius)*.92;if(Math.abs(o.x-b.x)<rr*.8&&o.y-b.y<rr){sp=Math.min(sp,Math.max(0,(o.y-b.y-rr*.85))*4);break;}}
      b.speed=b.rollDrag>G.t?sp*.19:sp;}}
  function breach(e){G.stats.breaches.push({t:+G.t.toFixed(2),kind:e.kind,hits:e.hits,hpLeft:e.hpc});G.lineFlash=.6;
    L.events.emit('impact',{material:e.material,speed:400,area:1500,x:e.x,y:K.LINE});C.sfx('bank',{x:e.x});
    for(let i=0;i<10;i++)L.addParticle({x:e.x,y:K.LINE,vx:(L.random()-.5)*260,vy:-L.random()*200,size:4,life:.5,color:[1,.45,.6,1]});
    $('breach').textContent=G.stats.breaches.length;$('breach-box').classList.remove('hit');void $('breach-box').offsetWidth;$('breach-box').classList.add('hit');}
  // ---------- growth: three upgrades maximum, time stops while choosing ----------
  function offerUpgrade(){if(G.paused)return;const pool=C.UPGRADES[G.cls].filter(u=>!G.hero.ups.has(u.id)).slice();
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(L.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    if(G.cls==='spinner'&&!G.hero.ups.size){const index=pool.findIndex(u=>u.id==='gale');[pool[0],pool[index]]=[pool[index],pool[0]];}
    const ch=pool.slice(0,2);G.paused=true;G.choice=ch;P.cancel();
    C.sfx('pause');
    $('up-n').textContent='LEVEL '+(G.hero.ups.size+2);
    $('up-power').textContent=G.cls==='roller'?'圧縮の深さと幅が広がる。':'威力 '+K.POWER[G.hero.ups.size]+' → '+K.POWER[G.hero.ups.size+1];
    $('up-cards').innerHTML=ch.map((u,i)=>`<button class="upcard" data-i="${i}"><b>${u.name}</b><span>${u.desc}</span></button>`).join('');
    for(const b of $('up-cards').querySelectorAll('button'))b.onclick=()=>choose(ch[+b.dataset.i]);
    $('upgrade').hidden=false; $('up-cards').querySelector('button').focus({preventScroll:true});}
  function choose(u){
    if(!G.choice?.includes(u))return;
    const h=G.hero;
    h.ups.add(u.id);G.stats.ups.push(u.id);G.paused=false;G.choice=null;
    $('upgrade').hidden=true;banner(u.name,u.desc);
    C.sfx('levelup');h.flashT=.8;
    W.rings.push({x:h.x,y:h.y,r0:30,r1:260,life:.6,total:.6,w:8,color:[1,.6,.8],alpha:.7});
  }
  // ---------- boss: the v0.5 three-layer material boss, descending slowly toward the line ----------
  function startBoss(){if(G.boss)return;
    if(W.bodies.length>170){const deb=W.bodies.filter(b=>b.active).sort((a,b)=>b.age-a.age);for(const b of deb.slice(0,W.bodies.length-170))b.removed=true;const keep=W.bodies.filter(b=>!b.removed);W.bodies.length=0;W.bodies.push(...keep);}
    G.boss=Stages.spawnBoss(G.stage);G.boss.cy=320;G.boss.totalHp=0;for(const b of W.bodies)if(b.bossPart){b.hp=b.hpMax=G.stage.hp[b.bossLayer];G.boss.totalHp+=b.hp;b.cracks=[];}G.stats.bossTime=G.t;banner(G.stage.bossName,'外側から割って、芯まで砕く');}
  function moveBoss(dt){const B=G.boss;B.cy=Math.min(560,B.cy+dt*26);B.rot=(B.rot||0)+dt*.22;const by=B.cy+Math.sin(G.t*1.3)*8;
    for(const b of W.bodies){if(!b.bossPart||b.active||b.flying||b.removed)continue;if(b.orbit){b.x=B.cx+Math.cos(b.orbit.a+B.rot)*b.orbit.d;b.y=by+Math.sin(b.orbit.a+B.rot)*b.orbit.d;b.angle=B.rot;}else{b.x=B.cx;b.y=by;}b.dirty=true;}}
  function bigBreak(){if(G.bossDown)return;G.bossDown=true;G.stats.bossDefeated=true;G.stats.bossSecs=G.t-G.stats.bossTime;G.slow=progress.motion?.75:0;C.sfx('finale');
    const B=G.boss,list=W.enemies().map(e=>({e,d:Math.hypot(e.x-B.cx,e.y-B.cy)})).sort((a,b)=>a.d-b.d),id=-1;G.actions.set(id,{id,kills:0,hurts:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,system:true,reported:true,info:{}});
    list.forEach(({e,d},i)=>{e.hpc=0;C.hit(e,()=>{const dx=e.x-B.cx,dy=e.y-B.cy,l=Math.hypot(dx,dy)||1;W.shatter(e,1600,{push:{x:dx/l*(300+L.random()*200),y:dy/l*(300+L.random()*200)-120},action:id,cause:'finale',stop:.008});},{action:id},.08+d/900*.5+i*.004);});
    W.rings.push({x:B.cx,y:B.cy,r0:40,r1:700,life:.9,total:.9,w:10,color:[1,.55,.8],alpha:.55});
    pop(360,380,'CRUSH!!','big');}
  function summarize(){const s=G.stats,lv=[0,1,2,3].map(()=>({actions:0,kills:0,best:0})),lat=[];
    for(const a of G.actions.values()){if(a.system)continue;s.best=Math.max(s.best,a.kills);s.bestChain=Math.max(s.bestChain,a.chainMax);
      lv[a.level].best=Math.max(lv[a.level].best,a.kills);if(a.phase!=='boss'){lv[a.level].actions++;lv[a.level].kills+=a.kills;}
      const fb=Math.min(a.firstBreak??1e9,a.firstHit??1e9);if(fb<1e9)lat.push(fb-a.fireT);}
    const pct=(a,q)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(q*b.length))];};
    s.byLevel=lv.map(l=>({...l,per:l.actions?l.kills/l.actions:null}));s.latency={n:lat.length,median:pct(lat,.5),p90:pct(lat,.9)};
    const m=a=>a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:null;s.hitsToKill={};for(const [k,v] of Object.entries(s.byKind))s.hitsToKill[k]=v.map(m);
    return s;}
  function finish(){P.cancel();G.state='result';ui.result(summarize());}

  // ---------- input: the finger names the place; the hero gets there (unchanged from v0.5) ----------
  const HOLD=.24;
  const P={ptr:null};
  P.down=p=>{if(G.state!=='play'||G.paused)return;const h=G.hero;G.gestureT=G.rt;P.ptr={start:p,last:p,anchor:p,t0:G.rt,moved:0,fired:0,charging:false,castAt:p,dir:null,redirected:false};
    if(h.cls==='crusher')C.jab(h,p);else if(h.cls==='caster')C.burst(h,p);else if(h.cls==='spinner')C.spinDown(h,P.ptr,p);else if(h.cls==='roller')C.rollerDown(h,P.ptr,p);};
  P.move=p=>{const q=P.ptr;if(!q||G.paused)return;const h=G.hero;q.moved+=dist(p,q.last);q.last=p;
    if(h.cls==='roller'){C.rollerMove(q,p);return;}
    if(q.charging){h.charge&&(h.charge.p=p);return;}
    if(h.cls==='spinner'){C.spinMove(h,q,p);return;}
    if(h.cls==='slasher'){const dx=p.x-q.anchor.x,dy=p.y-q.anchor.y,d=Math.hypot(dx,dy);
      if(d>=(q.fired?110:52)){const ux=dx/d,uy=dy/d,turn=q.dir?Math.acos(Math.max(-1,Math.min(1,ux*q.dir.x+uy*q.dir.y))):9;
        if((!q.fired||turn>.5||d>=220)&&G.rt-h.lastSlash>=.07){h.lastSlash=G.rt;if(q.fired)G.gestureT=G.rt;C.slash(h,q.anchor,ux,uy);q.fired++;q.dir={x:ux,y:uy};q.anchor=p;}}}
    else if(h.cls==='crusher'){if(!q.redirected&&q.moved>=40&&G.rt-q.t0<.35){const dx=p.x-q.start.x,dy=p.y-q.start.y,d=Math.hypot(dx,dy)||1;q.redirected=C.redirect(h,dx/d,dy/d);}}
    else if(dist(p,q.castAt)>=115){q.castAt=p;G.gestureT=G.rt;C.burst(h,p);}};
  P.up=p=>{const q=P.ptr;if(!q)return;P.ptr=null;const h=G.hero;if(h.cls==='roller'){C.rollerStop(q);return;}if(G.state!=='play'||G.paused)return;if(p)q.last=p;
    if(q.charging&&h.charge){const k=h.charge.k,at=h.charge.p;h.charge=null;C.release(h,at,k);return;}
    if(h.cls==='spinner'){C.spinUp(h,q,q.last);return;}
    if(h.cls==='slasher'&&!q.fired){const dx=q.last.x-q.start.x,dy=q.last.y-q.start.y,d=Math.hypot(dx,dy);if(d<22)C.spin(h,q.start,false);else C.slash(h,q.start,dx/d,dy/d);}};
  P.cancel=()=>{C.rollerStop(P.ptr);P.ptr=null;if(G.hero)G.hero.charge=null;};
  P.update=dt=>{const q=P.ptr,h=G.hero;if(h.cls==='roller'){C.rollerUpdate(h,q,dt);return;}if(h.cls==='spinner'&&q&&!q.charging)C.spinUpdate(h,q);if(q&&!q.charging&&q.moved<18&&G.rt-q.t0>=HOLD&&!(h.cls==='slasher'&&q.fired)){q.charging=true;h.charge={p:q.last,t0:G.rt,k:0};C.sfx('charge',h);}
    if(h.charge)h.charge.k=Math.min(1,(G.rt-h.charge.t0)/.7);};
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.x)*720/r.width,y:(e.clientY-r.y)*1280/r.height};};
  let pid=null;
  canvas.addEventListener('pointerdown',e=>{if(G.state!=='play'||G.paused||pid!==null||e.button!==0)return;L.audio?.init?.();pid=e.pointerId;canvas.setPointerCapture(e.pointerId);P.down(point(e));e.preventDefault();});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;P.move(point(e));});
  canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pid)return;pid=null;P.up(point(e));});
  canvas.addEventListener('pointercancel',e=>{if(e.pointerId!==pid)return;pid=null;P.cancel();});
  canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===pid){pid=null;P.cancel();}});
  window.addEventListener('blur',()=>{pid=null;P.cancel();});

  // ---------- simulation step ----------
  function step(dt){
    if(G.state!=='play'||G.paused)return;G.breaks=0;G.rt+=dt;P.update(dt);
    const scale=G.slow>0?.3:1;G.slow=Math.max(0,G.slow-dt);const sdt=dt*scale;G.t+=sdt;L.time=G.t;L.frame++;
    for(let i=G.later.length-1;i>=0;i--)if(G.later[i].at<=G.t){const q=G.later.splice(i,1)[0];q.fn();}
    C.updateHero(G.hero,sdt);C.updateCharge(G.hero,sdt);W.advance(sdt);
    if(W.freeze>0)W.freeze=Math.max(0,W.freeze-dt);else{W.physics(sdt);C.updateProjectiles(sdt);}
    W.decay(sdt);for(const b of G.bolts)b.life-=sdt;G.bolts=G.bolts.filter(b=>b.life>0);for(const g of G.glows)g.life-=sdt;G.glows=G.glows.filter(g=>g.life>0);for(const g of G.arcs)g.life-=sdt;G.arcs=G.arcs.filter(g=>g.life>0);
    G.lineFlash=Math.max(0,G.lineFlash-dt);
    for(const a of G.actions.values())if(!a.system&&!a.reported&&G.t-a.last>.45&&G.t-a.t0>.3){a.reported=true;if(a.kills>=6)gain(Math.min(ENERGY.bigCap,a.kills*ENERGY.bigHit),'bigHit');if(a.kills>=3){pop(Math.max(90,Math.min(630,G.hero.x)),Math.max(300,G.hero.y-110),a.kills+' KO'+(a.chainKills?' · 連鎖'+a.chainKills:''),a.kills>=15?'big':'ko');C.sfx('ko',{n:a.kills});}}
    for(const spark of G.sparks)spark.age+=sdt;
    G.sparks=G.sparks.filter(p=>p.age<.56);
    updateFlow(sdt);
  }

  // ---------- render ----------
  const BG=[{x:0,y:0,u:0,v:0},{x:720,y:0,u:1,v:0},{x:720,y:1280,u:1,v:1},{x:0,y:1280,u:0,v:1}];
  function heroQuad(h){const k=h.move?1.12:1,s=(h.cls==='roller'?88:82)*k,flip=Math.cos(h.face)<0?-1:1,bob=h.move?0:Math.sin(h.bob*4)*4;let sp=0;if(h.spin>0){h.spin-=1/60;sp=G.t*40;}
    const c=Math.cos(sp),si=Math.sin(sp),P2=(x,y)=>({x:h.x+(x*c-y*si),y:h.y+bob+(x*si+y*c)});const a=P2(-s,-s),b=P2(s,-s),cc=P2(s,s),d=P2(-s,s);
    return [{...a,u:flip>0?0:1,v:0},{...b,u:flip>0?1:0,v:0},{...cc,u:flip>0?1:0,v:1},{...d,u:flip>0?0:1,v:1}];}
  const TINT={slasher:[.2,.55,1],crusher:[1,.45,.3],caster:[.6,.35,1],spinner:[.88,.59,.19],roller:[.25,.75,.58]};
  function circle(p,r,w,col,seg=40,rot=0){let prev=null;for(let i=0;i<=seg;i++){const a=i/seg*6.283+rot,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(prev)renderer.flash(prev,q,w,col);prev=q;}}
  function draw(){
    renderer.begin();
    renderer.mesh('bg/'+G.stage.mat,BG,[0,1,2,0,2,3]);
    // the defence line: steady, pulses when something gets through
    const lf=G.lineFlash;if(!G.free)renderer.line({x:0,y:K.LINE},{x:720,y:K.LINE},4+lf*10,[1,.35+.3*(1-lf),.6,.75]);
    // "next to arrive" shadows under enemies close to the line
    for(const b of W.bodies){if(G.free||b.removed||b.active||b.team!=='enemy'||b.bossPart||b.y<K.DANGER)continue;const k=Math.min(1,(b.y-K.DANGER)/(K.LINE-K.DANGER));renderer.line({x:b.x-b.radius*.9,y:b.y+b.radius*.95},{x:b.x+b.radius*.9,y:b.y+b.radius*.95},5,[1,.3,.5,.25+.45*k*(.6+.4*Math.sin(G.t*10))]);}
    W.drawBodies(renderer);
    for(const b of W.bodies)if(!b.removed&&!b.active&&b.cracks)K.drawCracks(renderer,b);
    for(const g of G.glows){const k=g.life/g.total;renderer.glow(g.x,g.y,g.r*(1.1-k*.3),[...g.col,.35*k]);}
    for(const b of G.bolts){let prev=b.a;for(let i=1;i<=6;i++){const t=i/6,j=i<6?(Math.sin(b.seed+i*9.1)*14):0,p={x:b.a.x+(b.b.x-b.a.x)*t+j,y:b.a.y+(b.b.y-b.a.y)*t-j};renderer.flash(prev,p,4,[.4,.5,1,b.life/.14]);renderer.flash(prev,p,1.5,[.25,.2,.6,1]);prev=p;}}
    const h=G.hero;if(h){const col=TINT[h.cls];
      if(h.charge){const ch=h.charge,k=ch.k,r=h.cls==='caster'?C.bigRadius(h,k):h.cls==='crusher'?(150+k*90)*(h.ups.has('blast')?1.25:1):250*(h.ups.has('wide')?1.5:1);
        circle(ch.p,r,2+k*3,[...col,.45+k*.45],48,G.t*(h.cls==='caster'?2:0));circle(ch.p,r*(1-k)*.9+8,2,[.4,.3,.6,.5*(1-k)],32);if(k>=1)circle(ch.p,r+6+Math.sin(G.t*30)*3,3,[1,.3,.6,.8],48);}
      const lv=h.ups.size;renderer.glow(h.x,h.y+70,60,[.3,.2,.3,.35]);if(lv)circle({x:h.x,y:h.y+4},84+lv*8,1.5+lv,[...col,.35+.15*Math.sin(G.t*6)],36,G.t);
      renderer.mesh('hero/'+h.cls,heroQuad(h),[0,1,2,0,2,3]);}
    for(const g of G.arcs){const age=g.total-g.life,rev=Math.min(1,age/.1),f=Math.min(1,g.life/(g.total*.7)),n=g.pts.length-1,m=Math.ceil(n*rev);
      for(let i=0;i<m;i++){const a=g.pts[i],b=g.pts[i+1],w=(g.ws[i]+g.ws[i+1])/2;renderer.flash(a,b,w*.45*f+1,[...g.col,.5*f]);renderer.flash(a,b,2.4,[1,1,1,.95*f]);}}
    for(const p of G.sparks){
      const t=p.age/.56,x=p.x+(395-p.x)*t*t,y=p.y+(135-p.y)*t;
      renderer.glow(x,y,17,[...p.color.slice(0,3),1-t]);
      renderer.line({x:x-4,y:y+7},{x:x+3,y:y-4},4,[.98,.65,.24,1-t*.6]);
    }
    W.drawFx(renderer);renderer.render(W.particles,G.t,progress.motion?W.punch:0,progress.motion&&G.slow>0);
  }
  // ---------- HUD ----------
  const popsEl=$('pops');
  function pop(x,y,text,kind){const d=document.createElement('div');d.className='pop '+(kind||'');d.textContent=text;d.style.left=(x/720*100)+'%';d.style.top=(y/1280*100)+'%';popsEl.appendChild(d);setTimeout(()=>d.remove(),1100);}
  function banner(name,hint){$('banner').innerHTML=`<b>${name}</b><span>${hint}</span>`;$('banner').classList.remove('show');void $('banner').offsetWidth;$('banner').classList.add('show');}
  function hud(){
    if(G.state!=='play')return;
    const seconds=Math.max(0,Math.ceil(60-G.t));
    const clock=G.free?'∞':String(seconds).padStart(2,'0')+' 秒';
    if($('clock').textContent!==clock)$('clock').textContent=clock;
    if(!G.free)$('time').style.width=Math.max(0,100-G.t/60*100)+'%';
    if($('kills').textContent!==String(G.stats.kills))$('kills').textContent=G.stats.kills;
    const lv=G.hero.ups.size, k=lv>=3?1:G.energy/ENERGY.need[lv];
    $('upbar').style.width=Math.min(100,k*100)+'%';
    $('uplv').textContent=lv>=3?'MAX':'Lv '+(lv+1);
    $('upmeter').classList.toggle('gain',G.gainFlash>0);
    if(!G.paused)G.gainFlash=Math.max(0,G.gainFlash-1/60);
    if(G.boss){
      $('boss-meter').hidden=false;$('boss-name').textContent=G.stage.bossName;
      const hp=W.bodies.reduce((sum,b)=>sum+(!b.active&&!b.removed&&b.bossPart?b.hp:0),0);
      $('boss-progress').value=G.bossDown?0:hp/G.boss.totalHp;
    }
    const h=G.hero;$('combo').textContent=h.combo>=3&&G.rt-h.comboT<.75?'×'+h.combo:'';
  }
  // ---------- loop ----------

  const ui=window.StudioMenus({ L,C,G,Studio,progress,start,fillFree,cancel:P.cancel });
  let prev=0;
  function frame(ms){
    const dt=prev?Math.min(.05,(ms-prev)/1000):1/60;prev=ms;
    if(!testing)step(dt);
    if(G.state==='play'||G.state==='result')draw();
    hud();
    requestAnimationFrame(frame);
  }
  if(testing)window.StudioTest={G,input:P,step,draw,start,fillFree,world:W,targets:C.targets};
  requestAnimationFrame(frame);
  ui.ready();
})(window.LAB);
