/* CRUNCH LINE v0.7 — vertical defence: enemies march down toward the line at the bottom.
 * Enemies take several hits; every hit that does not break one CHIPS it: a real slice comes off on the hit side
 * (the cut face shows the material's inside), cracks spread from the hit, the body squashes and the material
 * sounds. Growth = power (hits needed drop: 3 → 1) on top of the v0.5 shape upgrades. */
(function(L){
  'use strict';
  const C=L.combat,W=L.world,K=C.crunch={},R=()=>L.random();
  K.LINE=1100;          // defence line (world y). The hero idles just above it (HOME_Y 1040).
  K.DANGER=K.LINE-250;  // below this an enemy glows: "next to arrive"
  K.POWER=[1,3,5];      // damage per hit by number of upgrades taken (0/1/2)
  // Enemy types. hp in "hits at power 1". Big, few and slow first; small and many later; then big and hard again.
  K.TYPES={
    weak:{mats:['wax','jelly'],r:[80,90],hp:3,speed:30,label:'ふつう'},
    mid:{mats:['wax','jelly','soap'],r:[38,44],hp:3,speed:62},
    swarm:{mats:['jelly','soap','wax','beadslime'],r:[27,32],hp:2,speed:84},
    hard:{mats:['kohaku'],r:[70,76],hp:15,speed:32,label:'硬い新型'}
  };
  K.power=h=>K.POWER[Math.min(2,h.ups.size)];
  K.spawn=(kind,x,y,o={})=>{const T=K.TYPES[kind],m=o.m||T.mats[Math.floor(R()*T.mats.length)],r=T.r[0]+R()*(T.r[1]-T.r[0]);
    const b=W.spawn(m,x,y,r,{variant:'grunt',lod:'book',extra:{hp:1,hpc:T.hp,hpMax:T.hp,kind,speed:T.speed*(o.speedK||1)*(.92+R()*.16),hits:0,born:C.state.t,pop:0,cracks:[],area0:0}});
    if(b){b.drift=null;b.area0=b.area;b.phase=R()*6.28;}return b;};

  // ---------- damage: chip, crack, squash, sound ----------
  // A slice comes off the side the hit came from (≈20–30 % of the body); the larger piece stays the enemy.
  K.hurt=(e,dmg,from,o={})=>{e.hits++;e.hpc-=dmg;e.lastHit=C.state.t;
    const dx=e.x-from.x,dy=e.y-from.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
    const hitP={x:e.x-ux*e.radius*.8,y:e.y-uy*e.radius*.8};
    let core=e;
    const left=e.hpc/e.hpMax,canChip=e.area>e.area0*.34;
    if(canChip){const off=e.radius*(.42+R()*.12),tilt=(R()-.5)*.7,a=Math.atan2(uy,ux)+Math.PI/2+tilt,cx=e.x-ux*off,cy=e.y-uy*off,Lc=e.radius*3;
      const keep={hpc:e.hpc,hpMax:e.hpMax,kind:e.kind,speed:e.speed,hits:e.hits,born:e.born,pop:0,area0:e.area0,phase:e.phase,lastHit:e.lastHit,cracks:[]};
      const d0=e.depth;e.depth=.5;   // a chip is not a kill: fracture() only reports depth-0 bodies
      const kids=W.cut(e,[{x:cx-Math.cos(a)*Lc,y:cy-Math.sin(a)*Lc},{x:cx+Math.cos(a)*Lc,y:cy+Math.sin(a)*Lc}],1300,{push:{x:-ux*120+(R()-.5)*160,y:-uy*60-160},cause:'chip',stop:.012});
      e.depth=d0;
      if(kids&&kids.length>1){kids.sort((a,b)=>b.area-a.area);core=kids[0];
        Object.assign(core,keep,{active:false,depth:0,vx:0,vy:0,spin:0,team:'enemy',flying:false,drift:null,hp:1,shard:null});core.dirty=true;
        for(const k of kids.slice(1)){k.vx+=-ux*90;k.vy+=-120;}
        L.events.emit('cut',{material:core.material,speed:1300,length:e.radius*1.4,depth:.45,area:e.area*.25,kills:0,x:e.x,y:e.y});}}
    // cracks grow from the hit point inward (local coordinates, they turn with the body)
    const face=core!==e?{x:e.x-ux*e.radius*(.42),y:e.y-uy*e.radius*(.42)}:hitP,toC=Math.atan2(core.y-face.y,core.x-face.x);
    const n=2+(dmg>1?1:0);for(let i=0;i<n;i++){const pts=[];let p={x:face.x+(R()-.5)*core.radius*.5,y:face.y+(R()-.5)*core.radius*.2},ang=toC+(R()-.5)*1.0,len=core.radius*(.45+.4*(1-left));
      for(let k=0;k<4;k++){pts.push(L.localPoint(core,p));const step=len/4;ang+=(R()-.5)*.9;p={x:p.x+Math.cos(ang)*step,y:p.y+Math.sin(ang)*step};}pts.push(L.localPoint(core,p));core.cracks.push(pts);}
    if(core.cracks.length>7)core.cracks.splice(0,core.cracks.length-7);
    core.squash=Math.max(core.squash||0,.7);core.flash=.12;
    L.events.emit('impact',{material:core.material,speed:700+dmg*80,area:Math.min(core.area,5000),x:core.x,y:core.y});
    L.events.emit('crumble',{material:core.material,count:3+dmg,x:core.x,y:core.y});
    for(let i=0;i<6;i++)L.addParticle({x:hitP.x,y:hitP.y,vx:-ux*(60+R()*160)+(R()-.5)*140,vy:-uy*(60+R()*120)-120*R(),size:3+R()*4,life:.45+R()*.3,color:K.matColor(core.material),floor:true});
    return core;};
  K.MATCOL={wax:[1,.62,.72,1],jelly:[.72,.55,1,1],soap:[.55,.9,.76,1],beadslime:[.5,.8,1,1],kohaku:[1,.75,.35,1],chalk:[.95,.95,.9,1],sand:[.95,.8,.55,1],sponge:[1,.9,.4,1]};
  K.matColor=m=>K.MATCOL[m]||[1,1,1,1];
  // the inside stays visible: every cut edge of a damaged enemy gets a band of its interior colour (+ a bright lip)
  K.INSIDE={wax:[1,.95,.8],jelly:[.93,.86,1],soap:[.93,1,.96],kohaku:[1,.92,.66],beadslime:[.82,.93,1],chalk:[1,1,.97],sand:[1,.92,.75],sponge:[1,.97,.7]};
  K.drawCracks=(r,b)=>{if(!b.cracks||!b.cracks.length)return;const inside=K.INSIDE[b.material]||[1,1,1],col=K.matColor(b.material);
    const P=W.currentPoly(b),n=P.length;
    for(let i=0;i<n;i++){const a=P[i],c=P[(i+1)%n];if(!a.cut||!c.cut)continue;const mx=(a.x+c.x)/2,my=(a.y+c.y)/2,dx=b.x-mx,dy=b.y-my,d=Math.hypot(dx,dy)||1,o=5;
      const A={x:a.x+dx/d*o,y:a.y+dy/d*o},B={x:c.x+dx/d*o,y:c.y+dy/d*o};r.line(A,B,10,[...inside,.95]);r.line(a,c,2.2,[col[0]*.75,col[1]*.6,col[2]*.7,.9]);
      if(b.material==='beadslime'||b.material==='kohaku'||b.material==='sponge'){for(let k=1;k<4;k++){const t=k/4,q={x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t};r.line(q,{x:q.x+1.5,y:q.y+1.5},3,[col[0]*.8,col[1]*.7,col[2]*.8,.7]);}}}
    const dark=[col[0]*.35,col[1]*.25,col[2]*.35,.8];
    for(const c of b.cracks){let prev=null;for(const q of c){const w=L.worldPoint(b,q);if(prev){r.line(prev,w,3.2,dark);r.line({x:prev.x-1.2,y:prev.y-1.2},{x:w.x-1.2,y:w.y-1.2},1.2,[1,1,1,.55]);}prev=w;}}};

  // ---------- the march, breaches ----------
  K.march=(dt,G,onBreach)=>{for(const e of W.bodies){if(e.removed||e.active||e.team!=='enemy'||e.bossPart)continue;
      if(e.flying||e.pressing)continue;if(e.drift)e.drift=null;
      // a launched enemy that has landed: a finished one (hpc 0) breaks where it lands; a knocked-back one marches again
      if(e.proj){const own=e.proj.owner;e.proj=null;if(e.hpc<=0){C.hit(e,()=>W.shatter(e,900,{action:own,cause:'chain-end',stop:.01}),{action:own});continue;}}
      const sp=e.speed||40;e.y+=sp*dt;e.x+=Math.sin(G.t*1.3+e.phase)*8*dt;e.dirty=true;
      if(e.flash)e.flash=Math.max(0,e.flash-dt);
      if(e.y>K.LINE+e.radius*.2){e.removed=true;onBreach(e);}}};

  // ---------- the studio background (bright, colourful, a floor that recedes to the top) ----------
  K.background=()=>{const c=document.createElement('canvas');c.width=720;c.height=1280;const g=c.getContext('2d');
    const sky=g.createLinearGradient(0,0,0,1280);sky.addColorStop(0,'#ffd9e8');sky.addColorStop(.35,'#fff1dc');sky.addColorStop(1,'#fff7ea');g.fillStyle=sky;g.fillRect(0,0,720,1280);
    // receding floor tiles (pseudo 70° view): lines converge to a point above the screen; coordinates stay 1:1
    const vx=360,vy=-520;g.strokeStyle='rgba(214,160,190,.28)';g.lineWidth=2;for(let i=-9;i<=9;i++){g.beginPath();g.moveTo(vx,vy);g.lineTo(360+i*120,1280);g.stroke();}
    for(let k=0;k<14;k++){const t=Math.pow(k/14,1.7),y=40+t*1240;g.globalAlpha=.18+.2*t;g.beginPath();g.moveTo(0,y);g.lineTo(720,y);g.stroke();}g.globalAlpha=1;
    // soft pastel confetti
    const cols=['#ffb3c7','#b9f0dd','#c9b6ff','#ffe39a','#a8dcff'];for(let i=0;i<70;i++){const x=(i*157)%720,y=(i*331)%1060,s=3+(i%4)*2;g.fillStyle=cols[i%5];g.globalAlpha=.35;g.beginPath();g.arc(x,y,s,0,6.283);g.fill();}g.globalAlpha=1;
    // the defence zone below the line
    const z=g.createLinearGradient(0,K.LINE,0,1280);z.addColorStop(0,'#ffe3ef');z.addColorStop(1,'#ffd0e2');g.fillStyle=z;g.fillRect(0,K.LINE,720,180);
    for(let x=-40;x<760;x+=40){g.fillStyle=(x/40)%2?'#ff8fb8':'#8fe3c8';g.beginPath();g.moveTo(x,K.LINE-6);g.lineTo(x+40,K.LINE-6);g.lineTo(x+28,K.LINE+8);g.lineTo(x-12,K.LINE+8);g.fill();}
    return c.toDataURL('image/png');};

  // Effects were tuned for a dark stage; on cream, near-white strokes vanish. Deepen light colours (hue kept).
  K.ink=col=>{const [r,g,b,a=1]=col,l=(r+g+b)/3;if(l<.7)return col;const sat=Math.max(r,g,b)-Math.min(r,g,b);if(sat<.06)return [.45,.3,.62,a];const f=v=>Math.max(0,Math.min(1,.45+(v-l)*3.5));return [f(r),f(g),f(b),a];};
})(window.LAB);
