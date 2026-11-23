/* CRUNCH LINE v0.7 TEMPO — comparison build of v0.7 (crunch/game.js copied; v0.7 itself is unchanged).
 * v0.7 playtest: with few enemies the opening was idle. Here the attack tempo stays the same all run and what
 * grows is how much one attack breaks: the opening always keeps 2–4 attackable enemies close, each takes 2–4 hits
 * and stays where it is between hits (no knock-away), a horde packs into a block mid-screen before it pushes on.
 * --- v0.7 header ---
 * CRUNCH LINE v0.7 — vertical defence × growth × material breaking.
 * Built on v0.5/v0.6 FEEL (feel/heroes.js controls unchanged): the finger names the place, the hero gets there.
 * Order of pleasures: break ONE slowly (chips, cracks, inside showing) → grow → the same enemy breaks in one hit →
 * a horde, swept → a harder new type, slow breaking again → giant multi-layer boss. Breaches are recorded, never
 * game over. Copied from feel/game.js and reshaped; bots: random / intent (looks at the clump, but takes the enemy
 * about to reach the line) / dense (v0.5 intent: clump only, ignores the line). */
(async function(L){
  'use strict';
  const C=L.combat,W=L.world,K=C.crunch,$=id=>document.getElementById(id),canvas=$('scene');
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const CLASSES={slasher:{name:'SLASHER',jp:'大剣士',help:['スワイプ：横に大きく斬る','長押し→離す：大回転斬り']},
    crusher:{name:'CRUSHER',jp:'拳闘士',help:['タップ：その敵を殴って押し返す（連打でラッシュ）','長押し→離す：圧縮パンチ']},
    caster:{name:'CASTER',jp:'魔法使い',help:['タップ：その場所に魔法','長押し→離す：吸い込んで一斉粉砕']}};
  L.config.maxBodies=230;L.config.maxDepth=6;
  C.MAT.chalk.armor=false;          // every hit goes through the same damage path (chips), no special armour rule
  Object.assign(window.LAB_ASSETS=window.LAB_ASSETS||{},C.makeHeroSprites(),{'bg/studio':K.background()});
  let renderer;try{await L.loadAssets();renderer=L.createRenderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent='WebGL2 を開始できません: '+e.message;return;}
  // light stage: deepen near-white effect strokes, soften additive glows
  {const f=renderer.flash.bind(renderer),rb=renderer.ribbon.bind(renderer),gl=renderer.glow.bind(renderer);
    renderer.flash=(a,b,w,col)=>f(a,b,w,K.ink(col));renderer.ribbon=(a,b,w,col)=>rb(a,b,w,K.ink(col));renderer.glow=(x,y,r,col)=>gl(x,y,r,[col[0],col[1],col[2],(col[3]??1)*.45]);}

  // ---------- run state ----------
  const G={state:'select',cls:'slasher',seed:1,t:0,rt:0,hero:null,boss:null,slow:0,actions:new Map(),stats:null,later:[],bolts:[],glows:[],arcs:[],history:[],headless:false,bot:null,bossDown:false,finaleT:0,paused:false,choice:null,broken:new Map(),gestureT:0,pickPolicy:null,sched:null,lineFlash:0,breakT:0};
  C.state=G;
  C.later=(dt,fn)=>G.later.push({at:G.t+dt,fn});
  C.bolt=(a,e)=>G.bolts.push({a:{x:a.x,y:a.y},b:{x:e.x,y:e.y},life:.14,seed:L.random()*1000});
  C.blade=(pts,ws,col)=>G.arcs.push({pts,ws,col,life:.34,total:.34});
  C.glow=(p,r,col)=>G.glows.push({x:p.x,y:p.y,r,col,life:.25,total:.25});
  C.touch=id=>{const a=G.actions.get(id);if(a&&a.firstHit==null)a.firstHit=G.rt;};
  C.locked=e=>!!(G.boss&&C.bossLocked(G.boss,e));
  C.begin=(h,kind,info={})=>{h.action++;h.lastKind=kind;h.idle=0;G.actions.set(h.action,{id:h.action,kind,cls:G.cls,kills:0,hurts:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,level:h.ups.size,inputT:G.gestureT,fireT:G.rt,firstBreak:null,reported:false,info,phase:phaseAt(G.t)});G.stats.actions++;if(G.stats.firstActionT==null)G.stats.firstActionT=G.t;};
  C.sfxGain=.75; // hero sounds a little behind the materials (v0.6 finding)
  // Every hit goes through here. Not enough damage → chip (visible + audible), enough → the hero's own break (cut/shatter).
  C.hit=(e,fn,h,delay=0,gen=0)=>{const run=()=>{if(e.removed||e.active||!W.bodies.includes(e))return;if(G.breaks>=5){C.later(.001,run);return;}G.breaks++;
      const aid=h&&h.action!=null?h.action:G.hero.action,act=G.actions.get(aid);
      if(e.bossPart&&e.hp>1){C.touch(G.hero.action);e.hp--;e.squash=1;e.pressing={age:0,duration:.18,done:()=>{}};K.bossChip(e);if(act)act.hurts++;
        L.events.emit('impact',{material:e.material,speed:900,area:Math.min(e.area,5000),x:e.x,y:e.y});L.events.emit('crumble',{material:e.material,count:4,x:e.x,y:e.y});
        const g=C.sfxGain;C.sfxGain=g*.3;C.sfx('pound',e);C.sfxGain=g;W.rings.push({x:e.x,y:e.y,r0:e.radius*.8,r1:e.radius*1.25,life:.2,total:.2,w:5,color:[1,.6,.8]});G.stats.bossHits++;return;}
      if(!e.bossPart&&e.hpc>0){const dmg=K.power(G.hero);if(e.hpc>dmg){C.touch(aid);K.hurt(e,dmg,G.hero);G.stats.hurts++;if(act)act.hurts++;return;}e.hits++;}
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
  {const hurt=K.hurt;K.hurt=(e,d,f,o)=>{const uid=e.uid??e.id,core=hurt(e,d,f,o);core.uid=uid;C.sfx('crack',{x:core.x,stage:core.hits});return core;};}
  K.bossChip=e=>{const P=e.poly;if(!P||!e.cracks)e.cracks=[];const a=L.random()*6.28,r=e.radius*.6,p0={x:Math.cos(a)*r*.2,y:Math.sin(a)*r*.2},pts=[p0];let p=p0,ang=a;for(let k=0;k<3;k++){ang+=(L.random()-.5)*.8;p={x:p.x+Math.cos(ang)*r*.3,y:p.y+Math.sin(ang)*r*.3};pts.push(p);}e.cracks.push(pts);if(e.cracks.length>6)e.cracks.shift();
    for(let i=0;i<5;i++)L.addParticle({x:e.x,y:e.y,vx:(L.random()-.5)*300,vy:-L.random()*260,size:3+L.random()*5,life:.5,color:K.matColor(e.material),floor:true});};
  W.onBreak=(b,opt)=>{const s=G.stats;s.kills++;if(s.firstKillT==null)s.firstKillT=G.t;G.broken.set(b.id,G.t);
    const a=G.actions.get(opt.action);if(a){a.kills++;a.last=G.t;if(a.firstBreak==null)a.firstBreak=G.rt;const gen=b.chainGen||0;if(gen>0){a.chainKills++;a.chainMax=Math.max(a.chainMax,gen);s.chainKills++;}}
    s.byMaterial[b.material]=(s.byMaterial[b.material]||0)+1;if(b.bossPart)G.stats.bossHits++;
    if(b.kind&&opt.cause!=='finale'){const lv=G.hero.ups.size,k=s.byKind[b.kind]=s.byKind[b.kind]||[[],[],[]];k[lv].push(b.hits||1);s.lifeOf.push({kind:b.kind,life:G.t-b.born,hits:b.hits||1,t:G.t});}
    if(G.boss&&b.id===G.boss.core.id)bigBreak();};

  // ---------- flow (60 s) ----------
  const BOSS_HP=[5,3,12],UP_AT=[{t:12},{t:24}],BOSS_T=40;
  const phaseAt=t=>t<12?'one':t<24?'grow':t<BOSS_T?'horde':'boss';
  function start(cls=G.cls,seed=G.seed){
    W.clear();L.seed(seed);L.time=0;L.frame=0;W.nextId=1;W.cutId=0;
    Object.assign(G,{cls,seed,t:0,rt:0,hero:C.createHero(cls),boss:null,slow:0,actions:new Map(),later:[],bolts:[],glows:[],arcs:[],bossDown:false,finaleT:0,paused:false,choice:null,broken:new Map(),gestureT:0,lineFlash:0,breakT:0,
      sched:{weak:0,mid:3,horde:0,hard:2,thin:0,firstHard:true}});
    G.stats={cls,seed,kills:0,actions:0,hurts:0,chainKills:0,best:0,bestChain:0,ups:[],bossTime:null,bossSecs:null,bossDefeated:false,bossHits:0,firstActionT:null,firstKillT:null,byMaterial:{},byKind:{},lifeOf:[],breaches:[],onScreen:[],danger:[],byLevel:null,latency:null};
    P.cancel();G.state='play';
    if(!G.headless){$('select').hidden=true;$('result').hidden=true;$('upgrade').hidden=true;$('hud').hidden=false;$('cls').textContent=CLASSES[cls].name+' '+CLASSES[cls].jp;$('help').innerHTML=CLASSES[cls].help.map(s=>`<span>${s}</span>`).join('');$('lv').innerHTML='';$('breach').textContent='0';}
    // the opening: two big, slow enemies — time to break one slowly
    K.spawn('weak',220,470,{m:'wax'});K.spawn('weak',500,360,{m:'jelly'});K.spawn('weak',330,230,{m:'wax'});
  }
  const alive=k=>{let n=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&(!k||b.kind===k))n++;return n;};
  // A formation shape from v0.4 (positions only), filled with the given type, entering from above the screen.
  function wave(kind,ids=['dense','mixed','column','dense'],dy=0){const want=ids[Math.floor(L.random()*ids.length)],f=C.FORMATIONS.find(x=>x.id===want),list=f.build(G.hero);
    const maxY=Math.max(...list.map(e=>e.y)),minX=Math.min(...list.map(e=>e.x)),maxX=Math.max(...list.map(e=>e.x)),sx=Math.min(1,560/(maxX-minX||1)),cx=(minX+maxX)/2;
    const keep=kind==='mid'?.45:1,sy=kind==='swarm'?.72:1,hold=kind==='swarm'?380+L.random()*200:null;for(const e of list){if(L.random()>keep)continue;const b=K.spawn(kind,360+(e.x-cx)*sx,(e.y-maxY)*sy+40+dy);if(b&&hold){b.holdY=Math.max(b.y,hold+(e.y-maxY)*sy);b.holdT=2.2;}}} /* the horde comes packed tight */
  function updateFlow(dt){
    if(G.state!=='play')return;
    tempoMotion(dt);K.march(dt,G,breach);dropLaunched();
    if(G.bench)return;
    const S=G.sched,t=G.t;for(const k of ['weak','mid','horde','hard','thin'])S[k]-=dt;
    if(!G.boss){
      if(t<12){const n=attackable();if((n<3&&S.weak<=0)||n<2){enter('weak',150+L.random()*420,170+L.random()*230);S.weak=.5;}}
      else if(t<24){const n=attackable();if((S.mid<=0&&alive()<26)||n<7){const y0=n<4?260:90;for(let i=0;i<5;i++){const b=K.spawn('mid',110+i*125+(L.random()-.5)*30,y0-(i%2)*70);if(b&&n<4){b.squash=1;W.rings.push({x:b.x,y:b.y,r0:10,r1:b.radius*1.5,life:.3,total:.3,w:5,color:[1,.55,.8],alpha:.6});}}S.mid=2.3;}if(S.weak<=0&&alive('weak')<2){enter('weak',150+L.random()*420,170+L.random()*120);S.weak=3;}}
      else{if(!S.surge){S.surge=true;wave('swarm');wave('swarm',['column']);S.horde=1.4;banner('大群','まとめて、一掃');} /* the horde arrives all at once */
        {const n=attackable(),room=W.bodies.length<170;if(room&&((S.horde<=0&&alive()<64)||(n<16&&S.horde<.9))){wave('swarm',undefined,n<8?260:0);S.horde=t<34?1.3:1.05;}} /* TEMPO: refill into reach when the field runs thin */
        if(S.hard<=0&&alive('hard')<3){const b=K.spawn('hard',150+L.random()*420,-80);S.hard=4.5;if(b&&S.firstHard){S.firstHard=false;banner('硬い新型：琥珀糖','何度も叩いて、ゆっくり砕く');}}}
      const i=G.stats.ups.length;if(i<2){if(t>=UP_AT[i].t)offerUpgrade();}
      else if(t>=BOSS_T)startBoss();}
    else if(!G.bossDown){if(S.thin<=0&&alive()<10){wave('swarm',['column']);S.thin=4.5;}}
    if(G.boss&&!G.bossDown){moveBoss(dt);if(G.t>56)bigBreak(true);}
    if(G.bossDown){G.finaleT+=dt;if(G.finaleT>4.2)finish();}
    // sampling for the analysis (4 Hz)
    if((G.sampleT=(G.sampleT||0)-dt)<=0){G.sampleT=.25;let n=0,d=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&b.y>-20){n++;if(b.y>K.DANGER)d++;}G.stats.onScreen.push([+t.toFixed(2),n]);G.stats.danger.push([+t.toFixed(2),d]);}
  }
  // a launched enemy that turns downward (bounced off the top) breaks there instead of falling through the line
  function dropLaunched(){for(const p of W.bodies){if(p.removed||p.active||!p.flying||!p.proj||p.vy<=0||p.bossPart)continue;const own=p.proj.owner;p.proj=null;p.flying=false;C.hit(p,()=>W.shatter(p,1200,{action:own,cause:'chain-end',stop:.01}),{action:own});}}
  // what can be hit right now: on screen (below the HUD) and above the line, not flying
  function attackable(){let n=0;for(const b of W.bodies)if(!b.removed&&!b.active&&b.team==='enemy'&&!b.bossPart&&!b.flying&&b.y>130&&b.y<K.LINE)n++;return n;}
  // a new opening enemy appears in reach (a pop + its material's knock), instead of walking in from off-screen
  function enter(kind,x,y){const b=K.spawn(kind,x,y);if(!b)return;b.squash=1;W.rings.push({x,y,r0:b.radius*.4,r1:b.radius*1.4,life:.3,total:.3,w:6,color:[1,.55,.8],alpha:.7});L.events.emit('impact',{material:b.material,speed:500,area:2000,x,y});}
  function tempoMotion(dt){for(const b of W.bodies){if(b.removed||b.active||b.team!=='enemy'||b.bossPart)continue;
      if(b.base==null)b.base=b.speed;
      if(b.nudge){const k=Math.min(1,dt/b.nudge.t);b.x+=b.nudge.x*k;b.y+=b.nudge.y*k;b.nudge.t-=dt;b.dirty=true;if(b.nudge.t<=0)b.nudge=null;}
      if(b.holdY!=null&&b.y>=b.holdY&&b.holdT>0){b.holdT-=dt;b.speed=b.base*.08;}else b.speed=b.base;}}
  function breach(e){G.stats.breaches.push({t:+G.t.toFixed(2),kind:e.kind,hits:e.hits,hpLeft:e.hpc});G.lineFlash=.6;
    L.events.emit('impact',{material:e.material,speed:400,area:1500,x:e.x,y:K.LINE});C.sfx('bank',{x:e.x});
    for(let i=0;i<10;i++)L.addParticle({x:e.x,y:K.LINE,vx:(L.random()-.5)*260,vy:-L.random()*200,size:4,life:.5,color:[1,.45,.6,1]});
    if(!G.headless){$('breach').textContent=G.stats.breaches.length;$('breach-box').classList.remove('hit');void $('breach-box').offsetWidth;$('breach-box').classList.add('hit');}}
  // ---------- growth: two picks per run, time stops while choosing ----------
  function offerUpgrade(){if(G.paused)return;const pool=C.UPGRADES[G.cls].filter(u=>!G.hero.ups.has(u.id)).slice();
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(L.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const ch=pool.slice(0,2);G.paused=true;G.choice=ch;P.cancel();
    if(G.headless||G.pickPolicy){choose((G.pickPolicy||(c=>c[0]))(ch));return;}
    C.sfx('pause');$('up-n').textContent=G.stats.ups.length+1;const pw=K.POWER[G.stats.ups.length+1];
    $('up-power').textContent=`どちらを選んでも 威力 ${K.POWER[G.stats.ups.length]} → ${pw}：${G.stats.ups.length?'硬い新型も数回で砕ける':'最初の敵が一撃で壊れる'}`;
    $('up-cards').innerHTML=ch.map((u,i)=>`<button class="upcard" data-i="${i}"><b>${u.name}</b><span>${u.desc}</span></button>`).join('');
    for(const b of $('up-cards').querySelectorAll('button'))b.onclick=()=>choose(ch[+b.dataset.i]);
    $('upgrade').hidden=false;}
  function choose(u){const h=G.hero;h.ups.add(u.id);G.stats.ups.push(u.id);G.paused=false;G.choice=null;if(!G.headless){$('upgrade').hidden=true;banner('強化：'+u.name,'威力 '+K.POWER[h.ups.size]+'・'+u.desc);$('lv').innerHTML=G.stats.ups.map(id=>`<i>${C.UPGRADES[G.cls].find(x=>x.id===id).name}</i>`).join('');}
    C.sfx('levelup');h.flashT=.8;W.rings.push({x:h.x,y:h.y,r0:30,r1:260,life:.6,total:.6,w:8,color:[1,.6,.8],alpha:.7});}
  // ---------- boss: the v0.5 three-layer material boss, descending slowly toward the line ----------
  function startBoss(){if(G.boss)return;
    if(W.bodies.length>170){const deb=W.bodies.filter(b=>b.active).sort((a,b)=>b.age-a.age);for(const b of deb.slice(0,W.bodies.length-170))b.removed=true;const keep=W.bodies.filter(b=>!b.removed);W.bodies.length=0;W.bodies.push(...keep);}
    G.boss=C.spawnBoss();G.boss.cy=250;for(const b of W.bodies)if(b.bossPart){b.hp=b.hpMax=b.bossLayer===0?BOSS_HP[0]:b.bossLayer===1?BOSS_HP[1]:BOSS_HP[2];b.cracks=[];}G.stats.bossTime=G.t;banner('巨大素材ボス','琥珀糖の殻 → 石鹸 → 粒入りスライムの核');}
  function moveBoss(dt){const B=G.boss;B.cy=Math.min(560,B.cy+dt*26);B.rot=(B.rot||0)+dt*.22;const by=B.cy+Math.sin(G.t*1.3)*8;
    for(const b of W.bodies){if(!b.bossPart||b.active||b.flying||b.removed)continue;if(b.orbit){b.x=B.cx+Math.cos(b.orbit.a+B.rot)*b.orbit.d;b.y=by+Math.sin(b.orbit.a+B.rot)*b.orbit.d;b.angle=B.rot;}else{b.x=B.cx;b.y=by;}b.dirty=true;}}
  function bigBreak(timeUp=false){if(G.bossDown)return;G.bossDown=true;G.stats.bossDefeated=!timeUp;if(!timeUp)G.stats.bossSecs=G.t-G.stats.bossTime;G.slow=timeUp?.4:.9;C.sfx('finale');
    const B=G.boss,list=W.enemies().map(e=>({e,d:Math.hypot(e.x-B.cx,e.y-B.cy)})).sort((a,b)=>a.d-b.d),id=-1;G.actions.set(id,{id,kills:0,hurts:0,chainMax:0,chainKills:0,t0:G.t,last:G.t,system:true,reported:true,info:{}});
    list.forEach(({e,d},i)=>{e.hpc=0;C.hit(e,()=>{const dx=e.x-B.cx,dy=e.y-B.cy,l=Math.hypot(dx,dy)||1;W.shatter(e,1600,{push:{x:dx/l*(300+L.random()*200),y:dy/l*(300+L.random()*200)-120},action:id,cause:'finale',stop:.008});},{action:id},.08+d/900*.5+i*.004);});
    W.rings.push({x:B.cx,y:B.cy,r0:40,r1:700,life:.9,total:.9,w:10,color:[1,.55,.8],alpha:.55});
    pop(360,380,timeUp?'TIME UP':'BREAK!!','big');}
  function summarize(){const s=G.stats,lv=[0,1,2].map(()=>({actions:0,kills:0,best:0})),lat=[];
    for(const a of G.actions.values()){if(a.system)continue;s.best=Math.max(s.best,a.kills);s.bestChain=Math.max(s.bestChain,a.chainMax);
      lv[a.level].best=Math.max(lv[a.level].best,a.kills);if(a.phase!=='boss'){lv[a.level].actions++;lv[a.level].kills+=a.kills;}
      const fb=Math.min(a.firstBreak??1e9,a.firstHit??1e9);if(fb<1e9)lat.push(fb-a.fireT);}
    const pct=(a,q)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(q*b.length))];};
    s.byLevel=lv.map(l=>({...l,per:l.actions?l.kills/l.actions:null}));s.latency={n:lat.length,median:pct(lat,.5),p90:pct(lat,.9)};
    const m=a=>a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:null;s.hitsToKill={};for(const [k,v] of Object.entries(s.byKind))s.hitsToKill[k]=v.map(m);
    return s;}
  function finish(){G.state='result';const s=summarize();G.history.push(JSON.parse(JSON.stringify(s)));if(!G.headless)showResult();}

  // ---------- input: the finger names the place; the hero gets there (unchanged from v0.5) ----------
  const HOLD=.24;
  const P={ptr:null};
  P.down=p=>{if(G.state!=='play'||G.paused)return;const h=G.hero;G.gestureT=G.rt;P.ptr={start:p,last:p,anchor:p,t0:G.rt,moved:0,fired:0,charging:false,castAt:p,dir:null,redirected:false};
    if(h.cls==='crusher')C.jab(h,p);else if(h.cls==='caster')C.burst(h,p);};
  P.move=p=>{const q=P.ptr;if(!q||G.paused)return;const h=G.hero;q.moved+=dist(p,q.last);q.last=p;
    if(q.charging){h.charge&&(h.charge.p=p);return;}
    if(h.cls==='slasher'){const dx=p.x-q.anchor.x,dy=p.y-q.anchor.y,d=Math.hypot(dx,dy);
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
    G.lineFlash=Math.max(0,G.lineFlash-dt);
    for(const a of G.actions.values())if(!a.system&&!a.reported&&G.t-a.last>.45&&G.t-a.t0>.3){a.reported=true;if(a.kills>=3&&!G.headless){pop(Math.max(90,Math.min(630,G.hero.x)),Math.max(300,G.hero.y-110),a.kills+' KO'+(a.chainKills?' · 連鎖'+a.chainKills:''),a.kills>=15?'big':'ko');C.sfx('ko',{n:a.kills});}}
    updateFlow(dt);if(G.bot&&!G.paused)G.bot(dt);
  }

  // ---------- render ----------
  const BG=[{x:0,y:0,u:0,v:0},{x:720,y:0,u:1,v:0},{x:720,y:1280,u:1,v:1},{x:0,y:1280,u:0,v:1}];
  function heroQuad(h){const k=h.move?1.12:1,s=100*k,flip=Math.cos(h.face)<0?-1:1,bob=h.move?0:Math.sin(h.bob*4)*4;let sp=0;if(h.spin>0){h.spin-=1/60;sp=G.t*40;}
    const c=Math.cos(sp),si=Math.sin(sp),P2=(x,y)=>({x:h.x+(x*c-y*si),y:h.y+bob+(x*si+y*c)});const a=P2(-s,-s),b=P2(s,-s),cc=P2(s,s),d=P2(-s,s);
    return [{...a,u:flip>0?0:1,v:0},{...b,u:flip>0?1:0,v:0},{...cc,u:flip>0?1:0,v:1},{...d,u:flip>0?0:1,v:1}];}
  const TINT={slasher:[.2,.55,1],crusher:[1,.45,.3],caster:[.6,.35,1]};
  function circle(p,r,w,col,seg=40,rot=0){let prev=null;for(let i=0;i<=seg;i++){const a=i/seg*6.283+rot,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(prev)renderer.flash(prev,q,w,col);prev=q;}}
  function draw(){
    renderer.begin();
    renderer.mesh('bg/studio',BG,[0,1,2,0,2,3]);
    // the defence line: steady, pulses when something gets through
    const lf=G.lineFlash;renderer.line({x:0,y:K.LINE},{x:720,y:K.LINE},4+lf*10,[1,.35+.3*(1-lf),.6,.75]);
    // "next to arrive" shadows under enemies close to the line
    for(const b of W.bodies){if(b.removed||b.active||b.team!=='enemy'||b.bossPart||b.y<K.DANGER)continue;const k=Math.min(1,(b.y-K.DANGER)/(K.LINE-K.DANGER));renderer.line({x:b.x-b.radius*.9,y:b.y+b.radius*.95},{x:b.x+b.radius*.9,y:b.y+b.radius*.95},5,[1,.3,.5,.25+.45*k*(.6+.4*Math.sin(G.t*10))]);}
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
    W.drawFx(renderer);renderer.render(W.particles,G.t,W.punch,G.slow>0);
  }
  // ---------- HUD ----------
  const popsEl=$('pops');
  function pop(x,y,text,kind){if(G.headless)return;const d=document.createElement('div');d.className='pop '+(kind||'');d.textContent=text;d.style.left=(x/720*100)+'%';d.style.top=(y/1280*100)+'%';popsEl.appendChild(d);setTimeout(()=>d.remove(),1100);}
  function banner(name,hint){if(G.headless)return;$('banner').innerHTML=`<b>${name}</b><span>${hint}</span>`;$('banner').classList.remove('show');void $('banner').offsetWidth;$('banner').classList.add('show');}
  function hud(){if(G.state!=='play')return;$('time').style.width=Math.max(0,100-G.t/60*100)+'%';$('kills').textContent=G.stats.kills;
    const i=G.stats.ups.length;if(i<2&&!G.boss){const prevT=i?UP_AT[i-1].t:0,k=(G.t-prevT)/(UP_AT[i].t-prevT);$('upbar').style.width=Math.min(100,k*100)+'%';$('upmeter').hidden=false;}else $('upmeter').hidden=true;
    const h=G.hero;$('combo').textContent=h.combo>=3&&G.rt-h.comboT<.75?'×'+h.combo:'';}
  const BEST_KEY='asmr-crunch-best-v07';function loadBest(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'{}');}catch(_){return {};}}function saveBest(b){try{localStorage.setItem(BEST_KEY,JSON.stringify(b));}catch(_){}}
  function bestLine(c){const b=loadBest()[c];return b?`ベスト ${b.kills} 撃破 · 侵入ゼロ ${b.perfect||0} 回`:'';}
  function refreshSelectBests(){for(const c of Object.keys(CLASSES)){const el=document.querySelector('#pick-'+c+' em');if(el)el.textContent=bestLine(c);}}
  function showResult(){const s=G.stats,U=C.UPGRADES[s.cls];$('hud').hidden=true;$('result').hidden=false;
    const all=loadBest(),prevB=all[s.cls]||{kills:0,best:0,boss:null,perfect:0,last:null},had=prevB.kills>0,perfect=!s.breaches.length;
    const rec={kills:s.kills>prevB.kills,boss:s.bossSecs!=null&&(prevB.boss==null||s.bossSecs<prevB.boss)};
    all[s.cls]={kills:Math.max(prevB.kills,s.kills),best:Math.max(prevB.best,s.best),boss:rec.boss?s.bossSecs:prevB.boss,perfect:(prevB.perfect||0)+(perfect?1:0),last:s.kills};saveBest(all);refreshSelectBests();
    const nw=k=>rec[k]&&had?'<i>NEW</i>':'';
    $('r-title').textContent=perfect?'PERFECT DEFENSE':s.bossDefeated?'すっきり！':'おつかれさま';$('result').classList.toggle('perfect',perfect);
    $('r-defense').innerHTML=perfect?'<b>侵入ゼロ</b>　ラインを守りきった':`侵入 <b>${s.breaches.length}</b>　（${s.breaches.map(b=>({weak:'ふつう',mid:'群れ',swarm:'大群',hard:'硬い新型'})[b.kind]||'').filter((v,i,a)=>a.indexOf(v)===i).join('・')}）`;
    $('r-stats').innerHTML=`<div><small>撃破</small><b>${s.kills}</b>${nw('kills')}</div><div><small>一手の最大</small><b>${s.best}</b></div><div><small>ボス撃破</small><b>${s.bossSecs!=null?s.bossSecs.toFixed(1)+'<em>秒</em>':'—'}</b>${nw('boss')}</div>`;
    const w=s.hitsToKill.weak||[],hd=s.hitsToKill.hard||[],f=v=>v==null?'—':(Math.round(v*10)/10)+'回';
    $('r-growth').innerHTML=`<p>最初の敵を壊すのに　<b>${f(w[0])}</b> → 強化後 <b>${f(w[2]??w[1])}</b></p>`+(hd.some(v=>v!=null)?`<p>硬い新型　<b>${f(hd[2]??hd[1])}</b> で砕けた</p>`:'')+`<p>今回の強化：${s.ups.map(id=>U.find(u=>u.id===id).name).join(' ＋ ')||'なし'}</p>`+(had&&prevB.last!=null?`<p>前回 ${prevB.last} 撃破 → 今回 ${s.kills} 撃破</p>`:'');}
  for(const k of Object.keys(CLASSES)){$('pick-'+k).onclick=()=>{L.audio?.init?.();start(k,G.seed);};$('again-'+k).onclick=()=>{L.audio?.init?.();start(k,G.seed);};}
  $('again').onclick=()=>{L.audio?.init?.();start(G.cls,G.seed);};$('newfield').onclick=()=>{L.audio?.init?.();start(G.cls,(G.seed*7919+13)%100000);};
  $('mute').onclick=()=>{C.muted=!C.muted;L.audio?.setEnabled?.(!C.muted);$('mute').textContent=C.muted?'🔇':'🔊';};

  // ---------- loop ----------
  let prev=0;function frame(ms){const dt=prev?Math.min(.05,(ms-prev)/1000):1/60;prev=ms;const t0=performance.now();step(dt);const t1=performance.now();if(G.state!=='select')draw();hud();const t2=performance.now();C.frameMs=t2-t0;C.updMs=t1-t0;C.drawMs=t2-t1;requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  // ---------- bots (same input path as a finger) ----------
  function seeded(n){let s=n>>>0;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
  function makeBot(skill){const rng=seeded(G.seed*977+skill.length*31),script=[];let cd=.3;
    const tap=p=>{script.push({at:G.rt,f:()=>P.down(p)},{at:G.rt+.05,f:()=>P.up(p)});};
    const swipe=(a,b,dur=.1)=>{script.push({at:G.rt,f:()=>P.down(a)});for(let i=1;i<=5;i++){const t=i/5,q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};script.push({at:G.rt+dur*t,f:()=>P.move(q)});}script.push({at:G.rt+dur+.01,f:()=>P.up(b)});};
    const hold=(p,secs)=>{script.push({at:G.rt,f:()=>P.down(p)},{at:G.rt+secs,f:()=>P.up(p)});};
    const bot=dt=>{while(script.length&&script[0].at<=G.rt+1e-9)script.shift().f();if(script.length)return;cd-=dt;if(cd>0||G.state!=='play')return;cd=skill==='casual'?.75+rng()*.3:.4; /* casual: a relaxed human tempo with a little aim error */
      const h=G.hero,en=C.targets().filter(e=>e.y>-10&&!(h.cls==='crusher'&&e.flying));if(!en.length)return;
      if(skill==='random'){const p={x:80+rng()*560,y:200+rng()*880},r=rng();if(r<.55)tap(p);else if(r<.92){const a=rng()*6.283,l=150+rng()*150;swipe(p,{x:p.x+Math.cos(a)*l,y:p.y+Math.sin(a)*l});}else hold(p,.8);return;}
      const t0=skill==='dense'?C.denseTarget(en,rng):C.intentTarget(en,rng),t=skill==='casual'?{...t0,x:t0.x+(rng()-.5)*60,y:t0.y+(rng()-.5)*60,id:t0.id}:t0;bot.last={id:t.id,y:t.y,lowest:Math.max(...en.filter(e=>!e.bossPart).map(e=>e.y),-1e9),t:G.t};(G.stats.aimY=G.stats.aimY||[]).push([+t.y.toFixed(0),+bot.last.lowest.toFixed(0)]);
      if(h.cls==='slasher'){const a=skill==='dense'?rng()*6.283:(rng()-.5)*.7,u={x:Math.cos(a),y:Math.sin(a)};swipe({x:t.x-u.x*110,y:t.y-u.y*110},{x:t.x+u.x*110,y:t.y+u.y*110});}else tap({x:t.x,y:t.y});};
    bot.idle=()=>!script.length;return bot;}
  // dense = v0.5 intent (the clump the eye goes to); intent v0.7 = the same, unless something is about to reach the line
  C.denseTarget=(en,rng)=>{const pool=G.boss&&!G.bossDown?en.filter(e=>e.bossPart):[];if(pool.length)return pool[Math.floor(rng()*pool.length)];
    const sc=en.map(e=>({e,n:en.filter(o=>dist(o,e)<130).length})).sort((a,b)=>b.n-a.n);return sc[Math.floor(rng()*Math.min(3,sc.length))].e;};
  C.intentTarget=(en,rng)=>{const near=en.filter(e=>!e.bossPart&&e.y>K.DANGER).sort((a,b)=>b.y-a.y);if(near.length)return near[0];return C.denseTarget(en,rng);};

  window.CRUNCH={version:'v0.7-tempo',
    state:G,start,
    test:{
      simulate(cls,seed,skill,opt={}){G.headless=true;G.pickPolicy=opt.pick?(ch=>ch.find(u=>u.id===opt.pick)||ch[0]):null;start(cls,seed);if(opt.noUpgrades)G.stats.ups=['-','-'];G.bot=skill?makeBot(skill):null;let n=0;const lim=(opt.seconds||75)*60;
        while(G.state==='play'&&n<lim){step(1/60);n++;}const s=summarize();const r={...JSON.parse(JSON.stringify(s)),seconds:n/60,state:G.state,skill};G.bot=null;G.headless=false;G.pickPolicy=null;G.state='select';W.clear();return r;},
      play(cls,seed,skill){start(cls,seed);G.bot=skill?makeBot(skill):null;},
      step,draw,input:P,C,K,hero:()=>G.hero,
    }
  };
  refreshSelectBests();$('loading').hidden=true;$('select').hidden=false;
})(window.LAB);
