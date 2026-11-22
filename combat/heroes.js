/* Three heroes with one shared input grammar (relative to the hero, one thumb):
 *   flick  = travel along the drawn shape (attack is the body moving)
 *   hold → pull → release = aimed special (slingshot)
 *   tap    = small assisted move at the hero
 * The classes differ in HOW the body/material breaks, not in damage numbers. */
(function(L){
  'use strict';
  const C=L.combat,W=L.world,S=L.slice,R=()=>L.random();
  const FIELD={x0:60,x1:660,y0:250,y1:1190};
  const clampP=p=>({x:Math.max(FIELD.x0,Math.min(FIELD.x1,p.x)),y:Math.max(FIELD.y0,Math.min(FIELD.y1,p.y))});
  function segDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
  C.segDist=segDist;C.FIELD=FIELD;C.clampP=clampP;

  // ---------- procedural hero sprites (Codex image generation was rate-limited) ----------
  C.makeHeroSprites=()=>{
    const out={};
    const draw=(id,fn)=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.translate(128,128);fn(g);out['hero/'+id]=c.toDataURL('image/png');};
    const body=(g,col,col2)=>{const gr=g.createRadialGradient(-18,-26,6,0,0,62);gr.addColorStop(0,col2);gr.addColorStop(1,col);g.fillStyle=gr;g.beginPath();g.ellipse(0,8,46,52,0,0,Math.PI*2);g.fill();g.fillStyle='#2b2240';g.beginPath();g.ellipse(-14,0,5,8,0,0,7);g.ellipse(14,0,5,8,0,0,7);g.fill();g.fillStyle='#ffffff55';g.beginPath();g.ellipse(-16,-24,16,8,-.5,0,7);g.fill();};
    draw('slasher',g=>{g.save();g.rotate(-.55);const sg=g.createLinearGradient(0,-120,0,10);sg.addColorStop(0,'#f6fbff');sg.addColorStop(1,'#9fc4e6');g.fillStyle=sg;g.beginPath();g.moveTo(-14,-10);g.lineTo(-10,-118);g.lineTo(0,-126);g.lineTo(10,-118);g.lineTo(14,-10);g.closePath();g.fill();g.fillStyle='#e7b35a';g.fillRect(-26,-12,52,10);g.fillStyle='#6b4b2e';g.fillRect(-6,-2,12,30);g.restore();body(g,'#3d7fd1','#a9d8ff');});
    draw('crusher',g=>{body(g,'#d1543d','#ffc0a6');for(const s of [-1,1]){const gr=g.createRadialGradient(s*58-8,10,4,s*58,18,38);gr.addColorStop(0,'#fff0d0');gr.addColorStop(1,'#e88b2f');g.fillStyle=gr;g.beginPath();g.ellipse(s*62,18,36,32,0,0,7);g.fill();g.strokeStyle='#7a3b10';g.lineWidth=3;for(let k=-1;k<=1;k++){g.beginPath();g.moveTo(s*62+k*10,0);g.lineTo(s*62+k*10,10);g.stroke();}}});
    draw('caster',g=>{g.fillStyle='#4a2f8f';g.beginPath();g.moveTo(-50,60);g.lineTo(0,-70);g.lineTo(50,60);g.closePath();g.fill();body(g,'#7b55d6','#e2d2ff');g.fillStyle='#4a2f8f';g.beginPath();g.moveTo(-40,-30);g.lineTo(4,-110);g.lineTo(40,-30);g.closePath();g.fill();g.strokeStyle='#c9a66b';g.lineWidth=6;g.beginPath();g.moveTo(58,70);g.lineTo(70,-60);g.stroke();const og=g.createRadialGradient(72,-74,2,72,-74,22);og.addColorStop(0,'#ffffff');og.addColorStop(.5,'#8ff6ff');og.addColorStop(1,'#8ff6ff00');g.fillStyle=og;g.beginPath();g.arc(72,-74,22,0,7);g.fill();});
    return out;
  };

  // ---------- shared hero ----------
  C.createHero=cls=>({cls,x:360,y:1010,vx:0,vy:0,dash:null,face:0,mana:6,manaMax:6,manaT:0,recoil:0,charge:0,aim:null,hitSet:new Set(),action:0,bob:0});
  function startDash(h,pts,speed,opt={}){
    const path=pts.map(clampP);let len=0;for(let i=1;i<path.length;i++)len+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    h.dash={path,i:1,speed,charged:!!opt.charged,kind:opt.kind||'dash',len};h.lastKind=h.dash.kind;h.hitSet=new Set();h.action++;C.newAction(h);
  }
  C.flick=(h,rel)=>{ // rel: stroke points relative to its first point (screen px, logical)
    if(h.dash)return false;const k=h.cls==='caster'?1.2:h.cls==='slasher'?1.5:1.65;const pts=[{x:h.x,y:h.y},...rel.slice(1).map(p=>({x:h.x+p.x*k,y:h.y+p.y*k}))];
    // CASTER's gust is free: it is positioning/setup, mana is for the payoff (lightning 2, gravity 4)
    startDash(h,pts,h.cls==='slasher'?2700:h.cls==='crusher'?2300:1500,{kind:'flick'});C.sfx('dash',h);return true;
  };
  C.tap=h=>{
    if(h.dash)return false;
    if(h.cls==='slasher')return spin(h);
    if(h.cls==='crusher')return pound(h);
    return lightning(h);
  };
  C.release=(h,pull)=>{ // pull: vector from press point to release point; action goes the opposite way
    if(h.dash)return false;const m=Math.hypot(pull.x,pull.y);if(m<18)return C.tap(h);const ux=-pull.x/m,uy=-pull.y/m,power=Math.min(1,m/160);
    if(h.cls==='caster'){if(h.mana<4)return C.denied(h);h.mana-=4;const p=clampP({x:h.x+ux*(120+power*440),y:h.y+uy*(120+power*440)});return gravity(h,p);}
    const reach=h.cls==='slasher'?520+power*360:380+power*320;startDash(h,[{x:h.x,y:h.y},{x:h.x+ux*reach,y:h.y+uy*reach}],h.cls==='slasher'?3200:2800,{charged:true,kind:'charged'});C.sfx('charge-release',h);return true;
  };
  // Preview for the slingshot (what will happen): drawn by game.js.
  C.aimPreview=(h,pull)=>{const m=Math.hypot(pull.x,pull.y);if(m<18)return null;const ux=-pull.x/m,uy=-pull.y/m,power=Math.min(1,m/160);
    if(h.cls==='caster'){const p=clampP({x:h.x+ux*(120+power*440),y:h.y+uy*(120+power*440)});return {kind:'well',p,r:300,core:130};}
    const reach=h.cls==='slasher'?520+power*360:380+power*320;return {kind:'line',a:{x:h.x,y:h.y},b:clampP({x:h.x+ux*reach,y:h.y+uy*reach}),power};};

  // ---------- per-frame hero motion & sweep ----------
  C.updateHero=(h,dt)=>{
    h.bob+=dt;if(h.cls==='caster'){h.manaT+=dt;while(h.manaT>.55){h.manaT-=.55;h.mana=Math.min(h.manaMax,h.mana+1);}}
    if(h.recoil>0){h.recoil-=dt;h.x+=h.vx*dt;h.y+=h.vy*dt;h.vx*=Math.exp(-10*dt);h.vy*=Math.exp(-10*dt);const p=clampP(h);h.x=p.x;h.y=p.y;}
    const d=h.dash;if(!d)return;
    let move=d.speed*dt;
    while(move>0&&h.dash){const t=d.path[d.i],dx=t.x-h.x,dy=t.y-h.y,dist=Math.hypot(dx,dy);const a={x:h.x,y:h.y};
      if(dist<=move){h.x=t.x;h.y=t.y;move-=dist;d.i++;}else{h.x+=dx/dist*move;h.y+=dy/dist*move;move=0;}
      if(dist>0.01)h.face=Math.atan2(dy,dx);
      W.trails.push({a,b:{x:h.x,y:h.y},life:.28,total:.28,w:h.cls==='slasher'?(d.charged?16:11):h.cls==='crusher'?8:6,color:h.cls==='slasher'?[.8,.95,1]:h.cls==='crusher'?[1,.75,.55]:[.75,.95,1],alpha:h.cls==='caster'?.5:.8});
      sweep(h,a,{x:h.x,y:h.y});
      if(h.dash&&d.i>=d.path.length)h.dash=null;}
  };
  function sweep(h,a,b){
    const d=h.dash,cls=h.cls;
    for(const e of W.enemies()){if(h.hitSet.has(e.id)||C.locked(e))continue;/* inner boss layers are behind the shell: the body passes over them */const reach=cls==='slasher'?(d.charged?58:42):cls==='crusher'?34:92;
      if(segDist(e,a,b)>e.radius+reach)continue;h.hitSet.add(e.id);
      if(cls==='slasher'){slash(h,e,a,b,d.charged);if(!h.dash)return;}
      else if(cls==='crusher'){punch(h,e,a,b,d.charged);return;}
      else gust(h,e,a,b);}
  }
  // SLASHER: cut along the travel line; armored (chalk) bounces the blade unless charged.
  function slash(h,e,a,b,charged){
    if(!charged&&C.MAT[e.material].armor&&e.hp>1){e.hp--;e.squash=.6;C.deflect(h,e,a,b);return;}
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
    C.hit(e,()=>W.cut(e,[{x:e.x-ux*e.radius*3,y:e.y-uy*e.radius*3+(segSide(e,a,b))},{x:e.x+ux*e.radius*3,y:e.y+uy*e.radius*3+(segSide(e,a,b))}],2600,{push:{x:ux*260,y:uy*260},action:h.action,cause:'slash'}),h);
  }
  function segSide(e,a,b){return 0;}
  function spin(h){h.lastKind='tap';h.action++;C.newAction(h);h.spin=.32;W.rings.push({x:h.x,y:h.y,r0:40,r1:170,life:.3,total:.3,w:6,color:[.85,.97,1],alpha:.8});C.sfx('spin',h);
    for(const e of W.enemies()){const dx=e.x-h.x,dy=e.y-h.y,d=Math.hypot(dx,dy);if(d>170+e.radius*.6)continue;
      if(C.locked(e))continue;if(C.MAT[e.material].armor&&e.hp>1){e.hp--;e.squash=.6;C.sfx('clink',e);continue;}
      const tx=-dy/(d||1),ty=dx/(d||1);C.hit(e,()=>W.cut(e,[{x:e.x-tx*e.radius*3,y:e.y-ty*e.radius*3},{x:e.x+tx*e.radius*3,y:e.y+ty*e.radius*3}],1800,{push:{x:dx/(d||1)*220,y:dy/(d||1)*220},action:h.action,cause:'spin'}),h,d/170*.09);}
    return true;}
  // CRUSHER: the punched enemy becomes a projectile; what it hits breaks; wall bounces allow bank shots.
  function punch(h,e,a,b,charged){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;h.dash=null;
    h.recoil=.16;h.vx=-ux*420;h.vy=-uy*420;W.freeze=Math.max(W.freeze,charged?.09:.06);W.punch=Math.max(W.punch,charged?.05:.03);C.sfx('punch',h,charged);
    W.rings.push({x:e.x,y:e.y,r0:e.radius*.6,r1:e.radius*1.8,life:.18,total:.18,w:5,color:[1,.85,.6]});
    if(e.bossPart){const blows=charged?2:1;for(let k=0;k<blows;k++)C.hit(e,()=>W.shatter(e,2200,{angle:Math.atan2(uy,ux)+Math.PI/2,push:{x:ux*620,y:uy*620},projectile:charged?2.4:1.6,owner:h.action,action:h.action,cause:'punch'}),h,k*.12);return;}
    const hard=C.MAT[e.material].hard;e.flying=true;e.drift=null;e.flyT=1.6;e.vx=ux*(charged?2500:1650);e.vy=uy*(charged?2500:1650);e.spin=(R()-.5)*14;e.squash=.7;
    e.proj={energy:(charged?3.8:2.05)*(.6+hard*.5),owner:h.action,gen:0,hits:0};C.markAction(h.action,e);
  }
  function pound(h){h.lastKind='tap';h.action++;C.newAction(h);W.freeze=Math.max(W.freeze,.05);W.punch=Math.max(W.punch,.035);C.sfx('pound',h);
    W.rings.push({x:h.x,y:h.y,r0:30,r1:180,life:.35,total:.35,w:9,color:[1,.8,.55],alpha:.7});
    for(const e of W.enemies()){const dx=e.x-h.x,dy=e.y-h.y,d=Math.hypot(dx,dy);if(d>180+e.radius*.5)continue;
      if(C.locked(e))continue;
      const u={x:dx/(d||1),y:dy/(d||1)};e.pressing={age:0,duration:.16+d/180*.14,done:b=>{if(C.MAT[b.material].armor&&b.hp>1){b.hp--;b.squash=.8;return;}
        C.hit(b,()=>W.shatter(b,1400,{angle:Math.atan2(u.y,u.x)+Math.PI/2,push:{x:u.x*380,y:u.y*380},projectile:.9,owner:h.action,action:h.action,cause:'pound'}),h);}};}
    return true;}
  // CASTER: gust (setup, no break), chain lightning through wet materials, gravity well implosion.
  function gust(h,e,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;if(C.locked(e)||e.bossPart)return;e.flying=true;e.drift=null;e.flyT=.55;e.vx=dx/len*520;e.vy=dy/len*520;e.spin=(R()-.5)*2;e.proj=null;}
  function lightning(h){
    if(h.mana<2)return C.denied(h);const en=W.enemies().filter(e=>!C.locked(e));if(!en.length)return false;h.mana-=2;h.lastKind='tap';h.action++;C.newAction(h);
    let first=null,best=1e9;for(const e of en){const d=Math.hypot(e.x-h.x,e.y-h.y);if(d<best&&d<560){best=d;first=e;}}if(!first){h.mana+=2;return false;}
    C.sfx('zap',h);const visited=new Set([first.id]),queue=[{e:first,from:{x:h.x,y:h.y-40},t:0}];let hops=0;
    while(queue.length&&hops<60){const q=queue.shift();hops++;C.later(q.t,()=>{C.bolt(q.from,q.e);const arcs=q.e.bossPart&&q.e.bossLayer===2?2:1;for(let k=0;k<arcs;k++)C.hit(q.e,()=>W.shatter(q.e,1100,{action:h.action,cause:'zap',stop:.012}),h,k*.12);});
      if(!C.MAT[q.e.material].wet)continue; // dry materials receive the bolt but do not pass it on
      const near=en.filter(o=>!visited.has(o.id)&&Math.hypot(o.x-q.e.x,o.y-q.e.y)<o.radius+q.e.radius+115).sort((p,r)=>Math.hypot(p.x-q.e.x,p.y-q.e.y)-Math.hypot(r.x-q.e.x,r.y-q.e.y)).slice(0,3);
      for(const o of near){visited.add(o.id);queue.push({e:o,from:{x:q.e.x,y:q.e.y},t:q.t+.045});}}
    return true;}
  function gravity(h,p){h.lastKind='well';h.action++;C.newAction(h);C.sfx('well',h);const id=h.action;
    C.wells.push({x:p.x,y:p.y,t:0,pull:.85,r:300,core:130,action:id});return true;}
  C.updateWells=dt=>{
    for(const w of C.wells){w.t+=dt;const en=W.enemies();
      if(w.t<w.pull){for(const e of en){if(C.locked(e)||e.bossPart)continue;const dx=w.x-e.x,dy=w.y-e.y,d=Math.hypot(dx,dy);if(d>w.r||d<8)continue;const k=(1-d/w.r)*900+300;e.drift=null;e.flying=true;e.flyT=.1;e.proj=null;e.vx=dx/d*k*Math.min(1,d/60);e.vy=dy/d*k*Math.min(1,d/60);e.squash=Math.min(.7,(e.squash||0)+dt*1.4);}
        L.events.emit('strain',{material:'beadslime',amount:w.t/w.pull,rate:2,x:w.x});}
      else if(!w.done){w.done=true;L.events.emit('strain',{material:'beadslime',amount:0,rate:0});W.freeze=Math.max(W.freeze,.08);W.punch=Math.max(W.punch,.05);C.sfx('implode',{x:w.x,y:w.y});
        W.rings.push({x:w.x,y:w.y,r0:w.core*1.4,r1:20,life:.2,total:.2,w:8,color:[.8,.7,1]},{x:w.x,y:w.y,r0:30,r1:w.r,life:.5,total:.5,w:5,color:[.85,.8,1],alpha:.6});
        const caught=en.filter(e=>Math.hypot(e.x-w.x,e.y-w.y)<w.core+e.radius*.5&&!C.locked(e));
        const kills=L.audio?.planWave?L.audio.planWave(caught.map(e=>({id:e.id,material:e.material,x:e.x,y:e.y})),{from:{x:w.x-200,y:w.y},to:{x:w.x+200,y:w.y}}):caught.map((e,i)=>({id:e.id,dt:i*8}));
        for(const k of kills){const e=caught.find(c=>c.id===k.id);if(!e)continue;C.later((k.dt||0)/1000,()=>{const dx=e.x-w.x,dy=e.y-w.y,d=Math.hypot(dx,dy)||1;C.hit(e,()=>W.shatter(e,1500,{push:{x:dx/d*520,y:dy/d*520},projectile:.7,owner:w.action,action:w.action,cause:'implode',stop:.01}),{action:w.action});});}
        for(const e of en)if(e.bossPart&&!caught.includes(e)&&!C.locked(e)&&Math.hypot(e.x-w.x,e.y-w.y)<w.r*.8)C.later(.05+Math.hypot(e.x-w.x,e.y-w.y)/2000,()=>C.hit(e,()=>W.shatter(e,1500,{action:w.action,cause:'implode',stop:.01}),{action:w.action}));
        // the bigger the crowd, the stronger the shockwave on everything just outside
        for(const e of en)if(!caught.includes(e)&&!C.locked(e)&&!e.bossPart){const dx=e.x-w.x,dy=e.y-w.y,d=Math.hypot(dx,dy)||1;if(d<w.r+80){const k=(200+caught.length*45)*(1-d/(w.r+80));e.flying=true;e.drift=null;e.flyT=.5;e.vx=dx/d*k;e.vy=dy/d*k;e.proj={energy:caught.length>=6?.8:0,owner:w.action,gen:1,hits:0};}}}}
    C.wells=C.wells.filter(w=>w.t<w.pull+.6);
  };
  C.wells=[];

  // ---------- projectiles & chains (CRUSHER's core, but any flying debris with energy can chain) ----------
  C.updateProjectiles=dt=>{
    const en=W.enemies();
    for(const p of W.bodies){
      if(p.removed)continue;
      // flying intact enemy (punched / blasted)
      if(p.flying&&p.proj&&p.proj.energy>0){
        if(p.x<FIELD.x0&&p.vx<0||p.x>FIELD.x1&&p.vx>0){p.vx*=-.85;p.proj.bank=(p.proj.bank||0)+1;C.sfx('bank',p);}
        if(p.y<FIELD.y0-60&&p.vy<0){p.vy*=-.8;p.proj.bank=(p.proj.bank||0)+1;}
        for(const e of en){if(e===p||e.flying||C.locked(e))continue;if(Math.hypot(e.x-p.x,e.y-p.y)>e.radius*.85+p.radius*.85)continue;
          const cost=C.MAT[e.material].hard/C.MAT[p.material].hard;p.proj.energy-=cost*.55;p.proj.hits++;
          const sp=Math.hypot(p.vx,p.vy);C.hit(e,()=>W.shatter(e,sp,{angle:Math.atan2(p.vy,p.vx)+Math.PI/2,push:{x:p.vx*.35,y:p.vy*.35},projectile:Math.max(0,p.proj.energy*.5),owner:p.proj.owner,action:p.proj.owner,cause:'chain',gen:p.proj.gen+1,stop:.015}),{action:p.proj.owner},0,p.proj.gen+1);
          p.vx*=.86;p.vy*=.86;if(p.proj.energy<=0)break;}
        if(p.proj.energy<=0||p.flyT<=0||Math.hypot(p.vx,p.vy)<200){p.flying=false;const own=p.proj.owner;p.proj=null;C.hit(p,()=>W.shatter(p,900,{action:own,cause:'chain-end',stop:.01}),{action:own});}
      }
      // flying pieces (shards) with leftover energy break what they hit — the cascade
      else if(p.shard&&p.shard.energy>.15&&p.active&&L.time-p.shard.born<.9){const sp=Math.hypot(p.vx,p.vy);if(sp<420)continue;
        for(const e of en){if(e.flying||C.locked(e))continue;if(Math.hypot(e.x-p.x,e.y-p.y)>e.radius*.8+p.radius*.6)continue;
          p.shard.energy-=C.MAT[e.material].hard*.6;C.hit(e,()=>W.shatter(e,sp,{angle:Math.atan2(p.vy,p.vx)+Math.PI/2,push:{x:p.vx*.3,y:p.vy*.3},projectile:Math.max(0,p.shard.energy*.6),owner:p.shard.owner,action:p.shard.owner,cause:'shard',stop:.01}),{action:p.shard.owner},0,p.shard.gen+1);break;}}
    }
  };
})(window.LAB);
