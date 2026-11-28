/* v0.5 FEEL — three heroes with "the attack happens where you touch" controls.
 * v0.4 moved the hero along the drawn shape relative to the hero; players aimed at enemies and the attack went
 * elsewhere. Here the finger names the target and the hero gets there by itself (auto lunge / auto distance).
 *   SLASHER: swipe = a big slash along the swipe direction, through the swiped place (fires mid-swipe; a long,
 *            turning stroke keeps slashing). tap = spin there. hold→release = big spin.
 *   CRUSHER: touch = dash to that enemy and punch (fires on touch-down; mash = rush). flick right after = aim the
 *            flying enemy. hold→release = compression punch.
 *   CASTER : touch = spell there (no mana). drag = spells along the path. hold→release = giant spell that sucks in.
 * Upgrades change the phenomenon (shape, sound, how things break), not damage numbers. */
(function(L){
  'use strict';
  const C=L.combat,W=L.world,R=()=>L.random();
  const FIELD={x0:60,x1:660,y0:250,y1:1190},HOME_Y=1040;
  const clampP=p=>({x:Math.max(FIELD.x0,Math.min(FIELD.x1,p.x)),y:Math.max(FIELD.y0,Math.min(FIELD.y1,p.y))});
  function segDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  C.segDist=segDist;C.FIELD=FIELD;C.clampP=clampP;C.HOME_Y=HOME_Y;
  const targets=()=>W.enemies().filter(e=>!C.locked(e));C.targets=targets;
  function nearest(en,p,max){let best=null,bd=max;for(const e of en){const d=dist(e,p)-e.radius*.5;if(d<bd){bd=d;best=e;}}return best;}
  C.nearest=nearest;

  C.UPGRADES={
    slasher:[{id:'wide',name:'大斬撃',desc:'刃の幅が2倍、長さが1.35倍。画面を横切る一振り。'},
             {id:'wave',name:'衝撃波',desc:'斬ったあと、刃の先へ衝撃波が走って砕く。'},
             {id:'double',name:'二重斬撃',desc:'一振りが交差する二連斬りになる。'}],
    crusher:[{id:'rush',name:'ラッシュ',desc:'踏み込みが速くなり、一打ごとに隣の敵も殴る。'},
             {id:'blast',name:'ぶっ飛ばし',desc:'殴った敵が大きく潰れ、遠くまで飛んで多くを巻き込む。'},
             {id:'quake',name:'追加破砕',desc:'飛んだ敵がぶつかるたび、その周りも砕ける。'}],
    caster:[{id:'wide',name:'大魔法陣',desc:'魔法の範囲が1.6倍。'},
            {id:'chain',name:'連鎖拡大',desc:'雷がどの素材も伝い、遠くまで何段も連鎖する。'},
            {id:'double',name:'二重爆発',desc:'魔法が二度弾ける。二度目はもっと大きい。'}]
  };

  // ---------- procedural hero sprites (same as v0.4; image generation is a later swap) ----------
  C.makeHeroSprites=()=>{
    const out={};
    const draw=(id,fn)=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.translate(128,128);fn(g);out['hero/'+id]=c.toDataURL('image/png');};
    const body=(g,col,col2)=>{const gr=g.createRadialGradient(-18,-26,6,0,0,62);gr.addColorStop(0,col2);gr.addColorStop(1,col);g.fillStyle=gr;g.beginPath();g.ellipse(0,8,46,52,0,0,Math.PI*2);g.fill();g.fillStyle='#2b2240';g.beginPath();g.ellipse(-14,0,5,8,0,0,7);g.ellipse(14,0,5,8,0,0,7);g.fill();g.fillStyle='#ffffff55';g.beginPath();g.ellipse(-16,-24,16,8,-.5,0,7);g.fill();};
    draw('slasher',g=>{g.save();g.rotate(-.55);const sg=g.createLinearGradient(0,-120,0,10);sg.addColorStop(0,'#f6fbff');sg.addColorStop(1,'#9fc4e6');g.fillStyle=sg;g.beginPath();g.moveTo(-14,-10);g.lineTo(-10,-118);g.lineTo(0,-126);g.lineTo(10,-118);g.lineTo(14,-10);g.closePath();g.fill();g.fillStyle='#e7b35a';g.fillRect(-26,-12,52,10);g.fillStyle='#6b4b2e';g.fillRect(-6,-2,12,30);g.restore();body(g,'#3d7fd1','#a9d8ff');});
    draw('crusher',g=>{body(g,'#d1543d','#ffc0a6');for(const s of [-1,1]){const gr=g.createRadialGradient(s*58-8,10,4,s*58,18,38);gr.addColorStop(0,'#fff0d0');gr.addColorStop(1,'#e88b2f');g.fillStyle=gr;g.beginPath();g.ellipse(s*62,18,36,32,0,0,7);g.fill();g.strokeStyle='#7a3b10';g.lineWidth=3;for(let k=-1;k<=1;k++){g.beginPath();g.moveTo(s*62+k*10,0);g.lineTo(s*62+k*10,10);g.stroke();}}});
    draw('caster',g=>{g.fillStyle='#4a2f8f';g.beginPath();g.moveTo(-50,60);g.lineTo(0,-70);g.lineTo(50,60);g.closePath();g.fill();body(g,'#7b55d6','#e2d2ff');g.fillStyle='#4a2f8f';g.beginPath();g.moveTo(-40,-30);g.lineTo(4,-110);g.lineTo(40,-30);g.closePath();g.fill();g.strokeStyle='#c9a66b';g.lineWidth=6;g.beginPath();g.moveTo(58,70);g.lineTo(70,-60);g.stroke();const og=g.createRadialGradient(72,-74,2,72,-74,22);og.addColorStop(0,'#ffffff');og.addColorStop(.5,'#8ff6ff');og.addColorStop(1,'#8ff6ff00');g.fillStyle=og;g.beginPath();g.arc(72,-74,22,0,7);g.fill();});
    return out;
  };

  C.createHero=cls=>({cls,x:360,y:HOME_Y,face:-Math.PI/2,move:null,queue:[],combo:0,comboT:-9,ups:new Set(),charge:null,bob:0,action:0,idle:0,lastCast:-9,lastSlash:-9,launched:null,spin:0,flashT:0});
  // Hero motion is automatic: it lunges to where the attack is. A short ease-out (it arrives fast, settles soft).
  function moveTo(h,p,dur){const b=clampP(p);h.move={a:{x:h.x,y:h.y},b,t:0,dur:Math.max(.016,dur)};h.idle=0;if(dist(h,b)>1)h.face=Math.atan2(b.y-h.y,b.x-h.x);}
  C.moveTo=moveTo;
  C.updateHero=(h,dt)=>{
    h.bob+=dt;h.flashT=Math.max(0,h.flashT-dt);
    if(h.move){const m=h.move;m.t+=dt;const k=Math.min(1,m.t/m.dur),e=1-Math.pow(1-k,3),px=h.x,py=h.y;h.x=m.a.x+(m.b.x-m.a.x)*e;h.y=m.a.y+(m.b.y-m.a.y)*e;
      if(h.cls!=='caster'&&dist({x:px,y:py},h)>4)W.trails.push({a:{x:px,y:py},b:{x:h.x,y:h.y},life:.16,total:.16,w:h.cls==='slasher'?7:9,color:h.cls==='slasher'?[.8,.95,1]:[1,.75,.55],alpha:.45});
      if(k>=1)h.move=null;}
    else{h.idle+=dt;if(h.queue.length){h.queue.shift()();}
      else if(h.idle>.7){const ty=h.cls==='caster'?HOME_Y:Math.max(h.y,900),tx=h.cls==='caster'?h.x:h.x,dy=ty-h.y;if(Math.abs(dy)>2)h.y+=Math.sign(dy)*Math.min(Math.abs(dy),260*dt);void tx;}}
  };

  // ======================= SLASHER =======================
  // A slash is a wide band along the swipe direction, through the swiped place. If the band would miss
  // everything, it slides sideways (≤150 px) onto the nearest enemy: "distance is corrected for you".
  C.slashBand=(h,anchor,ux,uy,o={})=>{const wide=h.ups.has('wide'),L0=(o.len||540)*(wide?1.35:1),w=(o.w||62)*(wide?2:1);
    const c=o.center?{...o.center}:{x:anchor.x+ux*L0*.28,y:anchor.y+uy*L0*.28};return {L0,w,c};};
  C.slash=(h,anchor,ux,uy,o={})=>{
    const G=C.state,{L0,w}=C.slashBand(h,anchor,ux,uy,o);let {c}=C.slashBand(h,anchor,ux,uy,o);const nx=-uy,ny=ux,en=targets();
    const ends=c=>[{x:c.x-ux*L0/2,y:c.y-uy*L0/2},{x:c.x+ux*L0/2,y:c.y+uy*L0/2}];
    const band=c=>{const [A,B]=ends(c);return en.filter(e=>segDist(e,A,B)<=e.radius+w);};
    let hit=band(c),shift=0;
    if(!hit.length&&!o.sub){let bs=null;for(const e of en){const t=(e.x-c.x)*ux+(e.y-c.y)*uy;if(Math.abs(t)>L0/2+60)continue;const s=(e.x-c.x)*nx+(e.y-c.y)*ny;if(Math.abs(s)<w+e.radius+150&&(bs===null||Math.abs(s)<Math.abs(bs)))bs=s;}
      if(bs!==null){shift=bs;c={x:c.x+nx*bs,y:c.y+ny*bs};hit=band(c);}}
    const [A,B]=ends(c);
    if(!o.sub){C.begin(h,'slash',{input:anchor,dir:{x:ux,y:uy},shift:Math.abs(shift),at:c});h.combo=G.rt-h.comboT<.75?Math.min(9,h.combo+1):1;h.comboT=G.rt;
      // the hero blinks to the start of the blade line and runs it
      const s0=clampP(A),s1=clampP(B);W.trails.push({a:{x:h.x,y:h.y},b:s0,life:.12,total:.12,w:3,color:[.8,.95,1],alpha:.3});h.x=s0.x;h.y=s0.y;moveTo(h,s1,.11);h.face=Math.atan2(uy,ux);}
    const id=o.id??h.action,combo=h.combo,wide=h.ups.has('wide');
    // blade trail: a crescent that sweeps along the line as fast as the cuts travel
    const col=o.sub?[1,.8,.95]:wide?[1,.92,.65]:[.82,.95,1],n=16,pts=[],ws=[];
    for(let i=0;i<=n;i++){const t=i/n,b=Math.sin(Math.PI*t);pts.push({x:A.x+(B.x-A.x)*t-nx*b*w*.4,y:A.y+(B.y-A.y)*t-ny*b*w*.4});ws.push(w*.9*(.12+.88*b)*(1+combo*.05));}
    C.blade(pts,ws,col);
    C.sfx('slash',{x:c.x,combo,n:hit.length,wide,sub:!!o.sub});W.punch=Math.max(W.punch,.02+Math.min(.03,hit.length*.003));
    for(const e of hit){const t=Math.max(0,Math.min(1,((e.x-A.x)*ux+(e.y-A.y)*uy)/L0)),delay=.012+t*.1;
      if(C.MAT[e.material].armor&&e.hp>1&&!e.bossPart){C.later(delay,()=>{if(e.removed||e.active)return;C.touch(id);e.hp--;e.squash=.8;C.sfx('clink',e);});continue;} // chalk cracks, the blade never stops
      const off=(R()-.5)*e.radius*.3;
      C.hit(e,()=>W.cut(e,[{x:e.x-ux*e.radius*3+nx*off,y:e.y-uy*e.radius*3+ny*off},{x:e.x+ux*e.radius*3+nx*off,y:e.y+uy*e.radius*3+ny*off}],2600,{push:{x:ux*300,y:uy*300},action:id,cause:'slash',stop:.014+Math.min(.02,combo*.003)}),h,delay);}
    if(h.ups.has('wave'))C.later(.1,()=>shock(h,id,A,B,ux,uy,w,wide));
    if(h.ups.has('double')&&!o.sub){const a2=Math.atan2(uy,ux)+(combo%2?1:-1)*1.05,cc={...c};C.later(.09,()=>C.slash(h,null,Math.cos(a2),Math.sin(a2),{sub:true,center:cc,len:470,id}));}
    return true;
  };
  // 衝撃波: after the cut, a pressure front spreads out to both sides of the blade line and shatters what it meets.
  function shock(h,id,A,B,ux,uy,w,wide){const reach=wide?190:150,nx=-uy,ny=ux;C.sfx('shock',{x:(A.x+B.x)/2});
    for(const side of [-1,1])for(let i=0;i<4;i++){const k=(i+1)/4;C.later(k*.12,()=>{const o={x:nx*side*(w+reach*k),y:ny*side*(w+reach*k)};W.trails.push({a:{x:A.x+o.x,y:A.y+o.y},b:{x:B.x+o.x,y:B.y+o.y},life:.18,total:.18,w:7*(1-k*.6),color:[.85,.95,1],alpha:.45});});}
    for(const e of targets()){if(segDist(e,A,B)>e.radius+w+reach)continue;const s=(e.x-A.x)*nx+(e.y-A.y)*ny,side=Math.sign(s)||1,d=Math.max(0,Math.abs(s)-w);
      if(C.MAT[e.material].armor&&e.hp>1&&!e.bossPart){C.later(d/reach*.12,()=>{if(!e.removed&&!e.active){e.hp--;e.squash=.8;}});continue;}
      C.hit(e,()=>W.shatter(e,1500,{angle:Math.atan2(uy,ux),push:{x:nx*side*360,y:ny*side*360},action:id,cause:'shock',stop:.008}),h,.02+d/reach*.12);}}
  C.spin=(h,p,big)=>{const G=C.state,q=clampP(p);C.begin(h,big?'bigspin':'spin',{input:p,at:q});const id=h.action,r=(big?250:150)*(h.ups.has('wide')?1.5:1);h.combo=G.rt-h.comboT<.75?Math.min(9,h.combo+1):1;h.comboT=G.rt;
    moveTo(h,q,.06);C.later(.06,()=>doSpin(h,id,q,r,false));return true;};
  function doSpin(h,id,q,r,sub){h.spin=.32;W.rings.push({x:q.x,y:q.y,r0:30,r1:r,life:.3,total:.3,w:sub?5:8,color:sub?[1,.8,.95]:[.85,.97,1],alpha:.85});C.sfx('spin',{x:q.x,big:r>200});W.punch=Math.max(W.punch,.03);
    for(const e of targets()){const dx=e.x-q.x,dy=e.y-q.y,d=Math.hypot(dx,dy);if(d>r+e.radius*.6)continue;
      if(C.MAT[e.material].armor&&e.hp>1&&!e.bossPart){e.hp--;e.squash=.6;continue;}
      const tx=-dy/(d||1),ty=dx/(d||1);C.hit(e,()=>W.cut(e,[{x:e.x-tx*e.radius*3,y:e.y-ty*e.radius*3},{x:e.x+tx*e.radius*3,y:e.y+ty*e.radius*3}],1900,{push:{x:dx/(d||1)*240,y:dy/(d||1)*240},action:id,cause:'spin',stop:.012}),h,d/r*.09);}
    if(h.ups.has('wave'))C.later(.12,()=>{W.rings.push({x:q.x,y:q.y,r0:r,r1:r+150,life:.25,total:.25,w:6,color:[.85,.95,1],alpha:.5});C.sfx('shock',{x:q.x});
      for(const e of targets()){const d=dist(e,q);if(d<r||d>r+150+e.radius)continue;const u={x:(e.x-q.x)/(d||1),y:(e.y-q.y)/(d||1)};C.hit(e,()=>W.shatter(e,1400,{angle:Math.atan2(u.y,u.x)+Math.PI/2,push:{x:u.x*380,y:u.y*380},action:id,cause:'shock',stop:.008}),h,(d-r)/150*.08);}});
    if(h.ups.has('double')&&!sub)C.later(.12,()=>doSpin(h,id,q,r*1.3,true));}

  // ======================= CRUSHER =======================
  function rayCount(o,u,len,skip){let n=0;const b={x:o.x+u.x*len,y:o.y+u.y*len};for(const e of targets()){if(e===skip||e.flying)continue;if(segDist(e,o,b)<e.radius*.85+30)n++;}return n;}
  C.rayCount=rayCount;
  C.jabTarget=p=>{const en=targets().filter(e=>!e.flying);return nearest(en,p,140)||nearest(en,p,300);};
  C.jab=(h,p)=>{const G=C.state;
    if(h.move){if(h.queue.length<2)h.queue.push(()=>C.jab(h,p));return true;} // mashing is buffered, never dropped
    const t=C.jabTarget(p);C.begin(h,'jab',{input:p,at:t?{x:t.x,y:t.y}:p,target:t?t.id:null});const id=h.action;
    h.combo=G.rt-h.comboT<.6?h.combo+1:1;h.comboT=G.rt;const combo=h.combo,fin=combo%5===0,rush=h.ups.has('rush');
    if(!t){moveTo(h,p,.06);C.later(.06,()=>pound(h,id,clampP(p),95));return true;}
    const dx=t.x-h.x,dy=t.y-h.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
    const dur=Math.max(.03,(rush?.045:.07)-Math.min(.025,combo*.004))*(Math.min(1,d/300)*.6+.4);
    moveTo(h,{x:t.x-ux*(t.radius+30),y:t.y-uy*(t.radius+30)},dur);
    C.later(dur,()=>impact(h,id,t,ux,uy,{fin,combo}));
    if(rush){const t2=nearest(targets().filter(e=>e!==t&&!e.flying),t,190);if(t2)C.later(dur+.07,()=>{if(t2.removed||t2.active)return;const ex=t2.x-h.x,ey=t2.y-h.y,dd=Math.hypot(ex,ey)||1;moveTo(h,{x:t2.x-ex/dd*(t2.radius+30),y:t2.y-ey/dd*(t2.radius+30)},.04);C.later(.04,()=>impact(h,id,t2,ex/dd,ey/dd,{combo:combo+1,second:true}));});}
    return true;};
  function impact(h,id,e,ux,uy,o){
    if(e.removed||e.active||!W.bodies.includes(e))return;C.touch(id);
    const blast=h.ups.has('blast'),fin=!!o.fin;C.sfx('punch',{x:e.x,combo:o.combo,strong:fin||blast});
    W.freeze=Math.max(W.freeze,fin?.08:.045);W.punch=Math.max(W.punch,fin?.05:.03);
    W.rings.push({x:e.x,y:e.y,r0:e.radius*.6,r1:e.radius*(fin?2.6:1.9),life:.18,total:.18,w:fin?8:5,color:[1,.85,.6]});
    if(e.bossPart){const blows=fin?4:3; /* heavy fists: the boss takes several blows per punch */for(let k=0;k<blows;k++)C.hit(e,()=>W.shatter(e,2200,{angle:Math.atan2(uy,ux)+Math.PI/2,push:{x:ux*620,y:uy*620},projectile:1.6,owner:id,action:id,cause:'punch'}),h,k*.1);return;}
    if(C.onPunch&&C.onPunch(h,id,e,ux,uy,{fin,blast}))return; /* v0.7 hook (inert before): a punch that does not break the enemy chips it and knocks it back */
    // launch toward the crowd: the player does not need to aim (±40° auto-aim)
    const base=Math.atan2(uy,ux);let best=base,bn=-1;for(let k=-4;k<=4;k++){const a=base+k*.17,n=rayCount(e,{x:Math.cos(a),y:Math.sin(a)},900,e)-Math.abs(k)*.05;if(n>bn){bn=n;best=a;}}
    const sp=(fin?2400:1750)*(blast?1.45:1),hard=C.MAT[e.material].hard;
    e.flying=true;e.drift=null;e.enter=0;e.flyT=1.6;e.vx=Math.cos(best)*sp;e.vy=Math.sin(best)*sp;e.spin=(R()-.5)*14;e.squash=blast?1.7:1.15;
    e.proj={energy:(fin?3.4:2.1)*(blast?1.7:1)*(.6+hard*.5),owner:id,gen:0,hits:0};
    h.launched={e,t:C.state.rt};
    if(blast){W.rings.push({x:e.x,y:e.y,r0:20,r1:150,life:.25,total:.25,w:7,color:[1,.7,.45],alpha:.7});
      for(const o of targets()){if(o===e||o.flying||o.bossPart)continue;const dx=o.x-e.x,dy=o.y-e.y,d=Math.hypot(dx,dy);if(d>130+o.radius)continue;const f=900*(1-d/(130+o.radius))+500;
        o.flying=true;o.drift=null;o.enter=0;o.flyT=.9;o.vx=dx/(d||1)*f+Math.cos(best)*300;o.vy=dy/(d||1)*f+Math.sin(best)*300;o.spin=(R()-.5)*10;o.squash=.9;o.proj={energy:1.1,owner:id,gen:1,hits:0};}}
    if(fin)pound(h,id,{x:e.x,y:e.y},135,e);}
  // flick right after the punch → the flying enemy goes that way (the "aim if you want" layer)
  C.redirect=(h,ux,uy)=>{const l=h.launched;if(!l||C.state.rt-l.t>.4||!l.e.flying||!l.e.proj)return false;const sp=Math.hypot(l.e.vx,l.e.vy);l.e.vx=ux*sp;l.e.vy=uy*sp;const a=C.state.actions.get(l.e.proj.owner);if(a)a.info.redirect=true;return true;};
  function pound(h,id,p,r,skip){C.sfx('pound',p);W.freeze=Math.max(W.freeze,.05);W.punch=Math.max(W.punch,.035);
    W.rings.push({x:p.x,y:p.y,r0:30,r1:r,life:.3,total:.3,w:8,color:[1,.8,.55],alpha:.7});
    for(const e of targets()){if(e===skip||e.flying)continue;const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);if(d>r+e.radius*.5)continue;
      const u={x:dx/(d||1),y:dy/(d||1)};if(e.bossPart){C.hit(e,()=>W.shatter(e,1400,{action:id,cause:'pound'}),h,.05);continue;}
      e.pressing={age:0,duration:.1+d/r*.1,done:b=>C.hit(b,()=>W.shatter(b,1400,{angle:Math.atan2(u.y,u.x)+Math.PI/2,push:{x:u.x*380,y:u.y*380},projectile:.9,owner:id,action:id,cause:'pound'}),h)};}}
  C.heavy=(h,p,k)=>{const q=clampP(p);C.begin(h,'heavy',{input:p,at:q});const id=h.action,blast=h.ups.has('blast'),r=(150+k*90)*(blast?1.25:1);
    moveTo(h,{x:q.x,y:q.y+70},.07);
    C.later(.07,()=>{C.sfx('heavy',q);W.freeze=Math.max(W.freeze,.1);W.punch=Math.max(W.punch,.06);
      W.rings.push({x:q.x,y:q.y,r0:r*1.2,r1:20,life:.16,total:.16,w:9,color:[1,.8,.5]},{x:q.x,y:q.y,r0:20,r1:r+90,life:.45,total:.45,w:6,color:[1,.85,.6],alpha:.6});
      for(const e of targets()){const dx=e.x-q.x,dy=e.y-q.y,d=Math.hypot(dx,dy);if(d>r+e.radius*.5)continue;const u={x:dx/(d||1),y:dy/(d||1)};
        if(e.bossPart){for(let j=0;j<2;j++)C.hit(e,()=>W.shatter(e,1800,{action:id,cause:'heavy',projectile:1.2,owner:id}),h,.06+j*.12);continue;}
        e.drift=null;e.flying=false;e.pressing={age:0,duration:.12+d/r*.12,done:b=>C.hit(b,()=>W.shatter(b,1800,{angle:Math.atan2(u.y,u.x)+Math.PI/2,push:{x:u.x*620,y:u.y*620},projectile:1.4*(blast?1.5:1),owner:id,action:id,cause:'heavy',stop:.01}),h)};}});
    return true;};

  // ======================= CASTER =======================
  C.castRadius=h=>135*(h.ups.has('wide')?1.6:1);
  C.burst=(h,p,o={})=>{const G=C.state;
    if(!o.sub){if(G.rt-h.lastCast<.12)return false;h.lastCast=G.rt;}
    const en=targets(),r=o.rAbs||C.castRadius(h);
    // snap a little toward the crowd under the finger (≤ 40 px) — assist, not auto
    let c={x:p.x,y:p.y};if(!o.sub){let sx=0,sy=0,n=0;for(const e of en)if(dist(e,p)<r){sx+=e.x;sy+=e.y;n++;}if(n){const mx=sx/n,my=sy/n,d=Math.hypot(mx-p.x,my-p.y)||1,k=Math.min(.5,40/d);c={x:p.x+(mx-p.x)*k,y:p.y+(my-p.y)*k};}}
    if(!o.sub){C.begin(h,'burst',{input:p,at:c,snap:dist(c,p)});moveTo(h,{x:Math.max(FIELD.x0,Math.min(FIELD.x1,h.x+(c.x-h.x)*.35)),y:HOME_Y},.25);h.face=Math.atan2(c.y-h.y,c.x-h.x);}
    const id=o.id??h.action;
    W.rings.push({x:c.x,y:c.y,r0:r*.15,r1:r,life:.3,total:.3,w:o.sub?9:7,color:o.sub?[1,.7,.95]:[.7,.9,1],alpha:.85});C.glow(c,r,o.sub?[1,.6,.9]:[.6,.85,1]);
    if(!o.sub)C.bolt({x:h.x+34,y:h.y-74},c);
    const caught=en.filter(e=>dist(e,c)<r+e.radius*.4);C.sfx('burst',{x:c.x,n:caught.length,sub:!!o.sub});
    for(const e of caught){const d=dist(e,c),u={x:(e.x-c.x)/(d||1),y:(e.y-c.y)/(d||1)};C.hit(e,()=>W.shatter(e,1400,{push:{x:u.x*320,y:u.y*320-60},projectile:h.ups.size?.3:0,owner:id,action:id,cause:'burst',stop:.008}),h,d/r*.07);}
    conduct(h,id,caught.filter(e=>!e.bossPart),en,new Set(caught.map(e=>e.id)));
    if(h.ups.has('double')&&!o.sub)C.later(.24,()=>C.burst(h,c,{sub:true,rAbs:r*1.3,id}));
    return true;};
  // Lightning conducts from what just broke into its neighbours: through wet materials, or through everything
  // with 連鎖拡大. Dry materials receive the bolt but do not pass it on.
  function conduct(h,id,from,en,vis){/* base: one hop (room to grow); 連鎖拡大: four hops through everything */const up=h.ups.has('chain'),depth=up?4:1,range=up?150:90;let front=from.filter(e=>up||C.MAT[e.material].wet),total=0;
    for(let g=1;g<=depth&&front.length&&total<40;g++){const next=[];
      for(const s of front){const near=en.filter(o=>!vis.has(o.id)&&dist(o,s)<o.radius+s.radius+range).sort((a,b)=>dist(a,s)-dist(b,s)).slice(0,up?3:2);
        for(const o of near){vis.add(o.id);total++;const from={x:s.x,y:s.y};C.later(g*.06,()=>{if(o.removed||o.active)return;C.bolt(from,o);C.hit(o,()=>W.shatter(o,1100,{action:id,cause:'zap',stop:.008}),h,0,g);});if(up||C.MAT[o.material].wet)next.push(o);}}
      front=next;}
    if(total)C.later(.06,()=>C.sfx('zap',{x:from[0]?.x}));}
  C.bigRadius=(h,k)=>(170+k*150)*(h.ups.has('wide')?1.35:1);
  C.big=(h,p,k)=>{const q=clampP(p);C.begin(h,'big',{input:p,at:q});const id=h.action,r=C.bigRadius(h,k);C.bolt({x:h.x+34,y:h.y-74},q);
    W.freeze=Math.max(W.freeze,.08);W.punch=Math.max(W.punch,.06);C.sfx('big',{x:q.x,k});
    W.rings.push({x:q.x,y:q.y,r0:r*1.2,r1:20,life:.2,total:.2,w:10,color:[.8,.7,1]},{x:q.x,y:q.y,r0:30,r1:r+120,life:.55,total:.55,w:6,color:[.85,.8,1],alpha:.6});C.glow(q,r*1.2,[.7,.55,1]);
    const en=targets(),caught=en.filter(e=>dist(e,q)<r+e.radius*.5);
    const kills=L.audio?.planWave?L.audio.planWave(caught.filter(e=>!e.bossPart).map(e=>({id:e.id,material:e.material,x:e.x,y:e.y})),{from:{x:q.x-200,y:q.y},to:{x:q.x+200,y:q.y}}):caught.map((e,i)=>({id:e.id,dt:i*8}));
    for(const kk of kills){const e=caught.find(c=>c.id===kk.id);if(!e)continue;const dx=e.x-q.x,dy=e.y-q.y,d=Math.hypot(dx,dy)||1;C.hit(e,()=>W.shatter(e,1500,{push:{x:dx/d*520,y:dy/d*520},projectile:.7,owner:id,action:id,cause:'big',stop:.01}),h,(kk.dt||0)/1000);}
    for(const e of caught)if(e.bossPart)for(let j=0;j<2;j++)C.hit(e,()=>W.shatter(e,1500,{action:id,cause:'big',stop:.01}),h,.05+j*.14+dist(e,q)/2400);
    conduct(h,id,caught.filter(e=>!e.bossPart).slice(0,8),en,new Set(caught.map(e=>e.id)));
    // what is just outside gets blown away and can chain (bigger crowd → stronger shockwave)
    for(const e of en)if(!caught.includes(e)&&!e.bossPart){const dx=e.x-q.x,dy=e.y-q.y,d=Math.hypot(dx,dy)||1;if(d<r+110){const f=(220+caught.length*40)*(1-d/(r+110));e.flying=true;e.drift=null;e.enter=0;e.flyT=.5;e.vx=dx/d*f;e.vy=dy/d*f;e.proj={energy:caught.length>=6?.8:0,owner:id,gen:1,hits:0};}}
    if(h.ups.has('double'))C.later(.3,()=>C.burst(h,q,{sub:true,rAbs:r*1.15,id}));
    return true;};
  // while charging, the spell circle follows the finger and sucks enemies in (the 予兆 of the giant spell)
  C.updateCharge=(h,dt)=>{const ch=h.charge;if(!ch)return;
    if(h.cls==='caster'){const r=C.bigRadius(h,ch.k)*1.35;for(const e of targets()){if(e.bossPart)continue;const dx=ch.p.x-e.x,dy=ch.p.y-e.y,d=Math.hypot(dx,dy);if(d>r||d<10)continue;const f=(1-d/r)*700+250;e.drift=null;e.enter=0;e.flying=true;e.flyT=.1;e.proj=null;e.vx=dx/d*f*Math.min(1,d/60);e.vy=dy/d*f*Math.min(1,d/60);e.squash=Math.min(.7,(e.squash||0)+dt*1.4);}
      L.events.emit('strain',{material:'beadslime',amount:ch.k,rate:2,x:ch.p.x});}};
  C.release=(h,p,k)=>{L.events.emit('strain',{material:'beadslime',amount:0,rate:0});if(h.cls==='slasher')return C.spin(h,p,true);if(h.cls==='crusher')return C.heavy(h,p,k);return C.big(h,p,k);};

  // ---------- projectiles & chains (CRUSHER's core; any flying debris with energy can chain) ----------
  C.updateProjectiles=dt=>{
    const en=W.enemies(),quake=C.state.hero&&C.state.hero.cls==='crusher'&&C.state.hero.ups.has('quake');
    for(const p of W.bodies){
      if(p.removed)continue;
      if(p.flying&&p.proj&&p.proj.energy>0){
        if(p.x<FIELD.x0&&p.vx<0||p.x>FIELD.x1&&p.vx>0){p.vx*=-.85;C.sfx('bank',p);}
        if(p.y<FIELD.y0-60&&p.vy<0)p.vy*=-.8;
        for(const e of en){if(!p.proj)break;if(e===p||e.flying||C.locked(e))continue;if(Math.hypot(e.x-p.x,e.y-p.y)>e.radius*.85+p.radius*.85)continue;
          const cost=C.MAT[e.material].hard/C.MAT[p.material].hard;p.proj.energy-=cost*.55;p.proj.hits++;
          const sp=Math.hypot(p.vx,p.vy),ang=Math.atan2(p.vy,p.vx)+Math.PI/2,pu={x:p.vx*.35,y:p.vy*.35},pe=Math.max(0,p.proj.energy*.5),po=p.proj.owner,pg=p.proj.gen+1,ex=e.x,ey=e.y;
          C.hit(e,()=>W.shatter(e,sp,{angle:ang,push:pu,projectile:pe,owner:po,action:po,cause:'chain',stop:.015}),{action:po},0,pg);
          if(quake&&p.proj.hits<=5){W.rings.push({x:ex,y:ey,r0:20,r1:95,life:.2,total:.2,w:5,color:[1,.75,.5],alpha:.6});C.sfx('quake',{x:ex});for(const o of en){if(o===e||o===p||o.flying||C.locked(o))continue;const d=Math.hypot(o.x-ex,o.y-ey);if(d>95+o.radius*.5)continue;C.hit(o,()=>W.shatter(o,1200,{push:{x:(o.x-ex)/(d||1)*300,y:(o.y-ey)/(d||1)*300},action:po,cause:'quake',stop:.008}),{action:po},.03+d/2000,pg+1);}}
          p.vx*=.86;p.vy*=.86;if(!p.proj||p.proj.energy<=0)break;}
        if(!p.proj)continue;
        if(p.proj.energy<=0||p.flyT<=0||Math.hypot(p.vx,p.vy)<200){p.flying=false;const own=p.proj.owner;p.proj=null;C.hit(p,()=>W.shatter(p,900,{action:own,cause:'chain-end',stop:.01}),{action:own});}
      }
      else if(p.shard&&p.shard.energy>.15&&p.active&&L.time-p.shard.born<.9){const sp=Math.hypot(p.vx,p.vy);if(sp<420)continue;
        for(const e of en){if(e.flying||C.locked(e))continue;if(Math.hypot(e.x-p.x,e.y-p.y)>e.radius*.8+p.radius*.6)continue;
          if(!p.shard)break;p.shard.energy-=C.MAT[e.material].hard*.6;const ang=Math.atan2(p.vy,p.vx)+Math.PI/2,pu={x:p.vx*.3,y:p.vy*.3},pe=Math.max(0,p.shard.energy*.6),po=p.shard.owner,pg=p.shard.gen+1;C.hit(e,()=>W.shatter(e,sp,{angle:ang,push:pu,projectile:pe,owner:po,action:po,cause:'shard',stop:.01}),{action:po},0,pg);break;}}
    }
  };
})(window.LAB);
