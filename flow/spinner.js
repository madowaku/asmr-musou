/* v0.8 SPINNER (双剣士): draw circles with the finger → the hero spins there with two blades and slices finely.
 * Gesture grammar (no buttons, no reading needed):
 *   circle (the path keeps turning one way ≥ ~230°)  → spinning: a slice "tick" every ~43° of finger rotation,
 *        centred on the circle, radius = the circle's size (small circle = carve one enemy, big = sweep a crowd).
 *        Slow circles still tick (at least every 0.3 s while the finger moves); faster circles tick more often and
 *        the spin combo raises damage a little and the pitch of the blades.
 *   tap  → a short "クルッ" spin there (3 ticks).      straight swipe → a dash that slices along the line.
 *   hold still → charge → release: a big whirl (8 ticks, radius grows with the charge).
 * Every tick is one attack (C.begin): its slices go through C.hit with their own damage, so an enemy with hits
 * left is chipped (shape, inside, cracks, sound) and one without breaks. */
(function(L){
  'use strict';
  const C=L.combat,W=L.world,K=C.crunch,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  C.UPGRADES.spinner=[{id:'wide',name:'大旋風',desc:'回転斬りの範囲が1.4倍。大きな円で群れごと巻き込む。'},
    {id:'blades',name:'四刀流',desc:'刃が4枚になり、一周で倍刻む。刻みも深くなる。'},
    {id:'gale',name:'吸い込み旋風',desc:'回すたび、周りの敵が円の中へ吸い寄せられる。'}];
  // procedural sprite: a mint round body with two crossed short blades
  {const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.translate(128,128);
    for(const s of [-1,1]){g.save();g.rotate(s*.7);const sg=g.createLinearGradient(0,-112,0,0);sg.addColorStop(0,'#ffffff');sg.addColorStop(1,'#8fe3c8');g.fillStyle=sg;g.beginPath();g.moveTo(-9,-8);g.lineTo(-6,-104);g.lineTo(0,-114);g.lineTo(6,-104);g.lineTo(9,-8);g.closePath();g.fill();g.fillStyle='#ff8fb8';g.fillRect(-18,-10,36,8);g.restore();}
    const gr=g.createRadialGradient(-16,-20,6,0,8,60);gr.addColorStop(0,'#e8fff6');gr.addColorStop(1,'#3fbf9a');g.fillStyle=gr;g.beginPath();g.ellipse(0,10,44,48,0,0,7);g.fill();
    g.fillStyle='#2b2240';g.beginPath();g.ellipse(-13,4,5,8,0,0,7);g.ellipse(13,4,5,8,0,0,7);g.fill();g.fillStyle='#ffffff66';g.beginPath();g.ellipse(-15,-18,14,7,-.5,0,7);g.fill();
    g.strokeStyle='#ff5f9e';g.lineWidth=6;g.beginPath();g.arc(0,10,50,-2.6,-0.5);g.stroke();
    Object.assign(window.LAB_ASSETS=window.LAB_ASSETS||{},{'hero/spinner':c.toDataURL('image/png')});}

  // the blades go where the finger draws (anywhere on the field); only the hero's own position is kept in its zone
  const inField=p=>({x:Math.max(20,Math.min(700,p.x)),y:Math.max(40,Math.min(1240,p.y))});
  const S={TURN:3.3,TICK:.75,MINLEN:90,R0:50,R1:230};C.SPIN=S;
  // one slice tick: two blades sweep the circle; every enemy on it is cut along the tangent
  C.spinTick=(h,c,r,o={})=>{const G=C.state,wide=h.ups.has('wide'),blades=h.ups.has('blades'),R=r*(wide?1.4:1)+h.ups.size*18;
    C.begin(h,'spin',{at:{x:c.x,y:c.y},r:R,circle:!!o.circle});const id=h.action;
    h.spinCombo=G.rt-(h.spinT??-9)<.4?Math.min(30,(h.spinCombo||0)+1):1;h.spinT=G.rt;
    const dmg=K.power(h)*(blades?1:.75)*(1+Math.min(.6,h.spinCombo*.03)),max=blades?20:14;
    if(dist(h,c)>30)C.moveTo(h,c,.08);h.spin=.26;
    const a0=(o.angle??G.rt*9)%(Math.PI*2),col=h.ups.size>=2?[1,.78,.35]:h.ups.size?[1,.5,.8]:[.35,.85,.7];
    for(let b=0;b<(blades?4:2);b++){const a=a0+b*Math.PI*2/(blades?4:2),pts=[],ws=[];for(let i=0;i<=10;i++){const t=i/10,aa=a-.9+t*.9;pts.push({x:c.x+Math.cos(aa)*R,y:c.y+Math.sin(aa)*R});ws.push(26*(.15+.85*Math.sin(Math.PI*t)));}C.blade(pts,ws,col);}
    if(o.ring!==false)W.rings.push({x:c.x,y:c.y,r0:R*.9,r1:R*1.05,life:.14,total:.14,w:3,color:col,alpha:.5});
    C.sfx('twin',{x:c.x,combo:h.spinCombo});
    const en=C.targets().filter(e=>dist(e,c)<R+e.radius*.5).sort((a,b)=>dist(a,c)-dist(b,c)).slice(0,max);
    for(const e of en){const dx=e.x-c.x,dy=e.y-c.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,tx=-uy,ty=ux,off=(L.random()-.5)*e.radius*.6;
      C.hit(e,()=>{
        // The vortex can pull the target between scheduling the hit and cutting it.
        const x=e.x+ux*off,y=e.y+uy*off,reach=e.radius*3;
        const line=[{x:x-tx*reach,y:y-ty*reach},{x:x+tx*reach,y:y+ty*reach}];
        return W.cut(e,line,1800,{push:{x:ux*160+tx*140,y:uy*160+ty*140},action:id,cause:'spin',stop:.006});
      },{action:id,dmg},Math.min(.06,d/R*.05));}
    if(h.ups.has('gale'))for(const e of C.targets()){if(e.bossPart)continue;const d=dist(e,c);if(d<R*.6||d>R*1.8)continue;e.nudge={x:(c.x-e.x)/d*26,y:(c.y-e.y)/d*26,t:.1};}
    W.punch=Math.max(W.punch,.012+Math.min(.02,en.length*.002));
    return en.length;};

  // ---------- gesture ----------
  // q = the pointer record from game.js (start,last,t0,moved…). We add: pts, turn (signed heading change), spin.
  C.spinDown=(h,q,p)=>{q.pts=[{x:p.x,y:p.y,t:C.state.rt}];q.turn=0;q.rot=0;q.head=null;q.spinning=false;q.len=0;q.lastTick=-9;};
  C.spinMove=(h,q,p)=>{const G=C.state,last=q.pts[q.pts.length-1],dx=p.x-last.x,dy=p.y-last.y,d=Math.hypot(dx,dy);if(d<3)return;
    q.pts.push({x:p.x,y:p.y,t:G.rt});while(q.pts.length>2&&G.rt-q.pts[0].t>.6)q.pts.shift();q.len+=d;
    const hd=Math.atan2(dy,dx);if(q.head!=null){let da=hd-q.head;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
      if(!q.spinning){q.turn+=da;if(Math.abs(q.turn)>=S.TURN&&q.len>=S.MINLEN){q.spinning=true;q.dir=Math.sign(q.turn);q.spinT0=G.rt;G.stats.spinStarts=(G.stats.spinStarts||0)+1;}}
    }
    q.head=hd;
    // ticks follow the finger's angle AROUND the circle's centre (not the wiggle of the stroke): a sloppy or shaky
    // circle slices at the same rate as a clean one
    if(q.spinning){const P=q.pts.filter(p=>G.rt-p.t<.5),c=P.length>=4?{x:P.reduce((a,p)=>a+p.x,0)/P.length,y:P.reduce((a,p)=>a+p.y,0)/P.length}:null;
      if(c){const ang=Math.atan2(p.y-c.y,p.x-c.x);if(q.cang!=null){let d=ang-q.cang;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;if(Math.sign(d)===q.dir)q.rot+=Math.abs(d);}q.cang=ang;}
      if(q.rot>=S.TICK){q.rot=Math.min(q.rot-S.TICK,S.TICK);C.spinFrom(h,q);}}};
  // slow circles keep ticking (no need to whirl the finger): at least every 0.3 s while the finger is moving
  C.spinUpdate=(h,q)=>{const G=C.state;if(!q||!q.spinning)return;const lastP=q.pts[q.pts.length-1];if(G.rt-lastP.t<.15&&G.rt-q.lastTick>.3)C.spinFrom(h,q);};
  C.spinFrom=(h,q)=>{const G=C.state,recent=q.pts.filter(p=>G.rt-p.t<.5);const P=recent.length>=3?recent:q.pts;
    const c={x:P.reduce((s,p)=>s+p.x,0)/P.length,y:P.reduce((s,p)=>s+p.y,0)/P.length},r=Math.max(S.R0,Math.min(S.R1,P.reduce((s,p)=>s+dist(p,c),0)/P.length*1.15));
    const last=q.pts[q.pts.length-1];q.lastTick=G.rt;q.ticks=(q.ticks||0)+1;C.spinTick(h,inField(c),r,{circle:true,angle:Math.atan2(last.y-c.y,last.x-c.x),direction:q.dir});};
  C.spinUp=(h,q,p)=>{const G=C.state;if(q.spinning){G.stats.spinTicks=(G.stats.spinTicks||0)+(q.ticks||0);return;}
    if(q.moved<18){const c=inField(p);for(let i=0;i<3;i++)C.later(i*.08,()=>C.spinTick(h,c,80,{angle:i*2.1,ring:i===0}));return;}   // tap: クルッ
    if(q.moved>=60){const a=q.start,b=p,dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;C.begin(h,'dash',{at:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}});const id=h.action;   // straight swipe: dash-slice
      h.x=C.clampP(a).x;h.y=C.clampP(a).y;C.moveTo(h,b,.12);h.spin=.2;C.sfx('twin',{x:b.x,combo:3});C.blade([a,{x:(a.x+b.x)/2-dy/l*20,y:(a.y+b.y)/2+dx/l*20},b],[8,26,8],[.35,.85,.7]);
      for(const e of C.targets()){if(C.segDist(e,a,b)>e.radius+50)continue;const t=Math.max(0,Math.min(1,((e.x-a.x)*dx+(e.y-a.y)*dy)/(l*l)));
        C.hit(e,()=>W.cut(e,[{x:e.x-dx/l*e.radius*3,y:e.y-dy/l*e.radius*3},{x:e.x+dx/l*e.radius*3,y:e.y+dy/l*e.radius*3}],2000,{push:{x:-dy/l*200,y:dx/l*200},action:id,cause:'dash',stop:.01}),{action:id,dmg:K.power(h)*.9},t*.12);}}};
  // hold → release: the big whirl
  const rel=C.release;C.release=(h,p,k)=>{if(h.cls!=='spinner')return rel(h,p,k);const c=inField(p),r=150+k*120;for(let i=0;i<8;i++)C.later(i*.06,()=>C.spinTick(h,c,r,{angle:i*.8,ring:i%2===0}));C.sfx('spin',{x:c.x,big:true});W.rings.push({x:c.x,y:c.y,r0:30,r1:r*1.3,life:.5,total:.5,w:8,color:[.35,.85,.7],alpha:.6});return true;};
})(window.LAB);
