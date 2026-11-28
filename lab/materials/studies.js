/* Material studies R1 (director-implemented while Codex was rate-limited):
 * soap / sand / chalk / sponge / beadslime / kohaku. Each follows its 予兆→解放→余韻 profile
 * (docs/v0.3/ASMR_TEMPORAL_STRUCTURE.md). Debris that lands on the floor emits `impact`, so collapse
 * tails are driven by physics, not by a synthetic metronome. */
(function(L){
  'use strict';
  const S=L.slice,R=()=>L.random(),fx=n=>L.fxSlots[n],pick=a=>a[Math.floor(R()*a.length)];
  const post=m=>L.timing.duration(m,'post')||.6;

  // Cut-face helpers ------------------------------------------------------------------------
  function faces(body){const out=[];for(let i=0;i<body.poly.length;i++){const a=body.poly[i];if(a.cut)out.push([a,body.poly[(i+1)%body.poly.length]]);}return out;}
  function alongFaces(body,n,fn){const fs=faces(body);if(!fs.length)return;for(let i=0;i<n;i++){const [a,b]=pick(fs),t=R(),p=L.worldPoint(body,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});fn(p,i);}}
  // Brittle materials get a ragged fracture edge (chalk, sand) instead of a razor line.
  function roughen(body,amp,step){
    if(!body.depth)return;const out=[];
    for(let i=0;i<body.poly.length;i++){const a=body.poly[i],b=body.poly[(i+1)%body.poly.length];out.push(a);
      if(!a.cut)continue;const len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.floor(len/step);if(n<2)continue;const nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
      for(let j=1;j<n;j++){const p=S.interpolate(a,b,j/n),o=(R()-.5)*2*amp;out.push({...p,x:p.x+nx*o,y:p.y+ny*o,cut:a.cut});}}
    // Jitter can fold a short edge over a neighbour; keep the ragged edge only if it still triangulates.
    try{S.triangulate(out);body.poly=out;body.meshIndices=null;}catch(_){/* keep the clean cut */}
  }
  function cutLine(body){const fs=faces(body);if(!fs.length)return null;const [a,b]=fs[0],len=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len,side=Math.sign(-a.x*nx-a.y*ny)||1;return {a:{x:a.x,y:a.y},nx,ny,side};}
  const base=(id,name,extra)=>L.registerMaterial(Object.assign({id,name,hardness:.5,layers:{shell:null,core:{}},crossSection:{width:16},init(){},onPress(){},onImpact(){},update(){},onCut(){}},extra));

  // 石鹸 SOAP — almost no 予兆; a clean ショリッ; then the cut face sheds little cubes that tumble and clack.
  base('soap','石鹸',{hardness:.35,layers:{shell:null,core:{color:'#bfe8cf'}},
    onCut(body,cut){
      const grunt=body.radius<70;
      for(const child of cut.children){child.soap={t:0,next:0,left:grunt?6:26,span:post('soap')*.8};child.gScale=.85;}
      alongFaces(body,grunt?2:7,p=>L.addParticle({x:p.x,y:p.y,kind:fx(pick(['soap_cube_a','soap_cube_b','soap_cube_c'])),size:(grunt?8:13)+R()*8,vx:(R()-.5)*170,vy:-90-R()*140,spin:(R()-.5)*12,color:[1,1,1,1],life:2,floor:true,bounce:.38,sound:'soap'}));
      L.events.emit('crumble',{material:'soap',count:grunt?3:8,x:body.x,y:body.y});
      // a few thin shavings flick off the blade line on the cut frame
      for(const f of cut.faces)for(let i=0;i<(grunt?1:3);i++){const t=R();L.addParticle({x:f.a.x+(f.b.x-f.a.x)*t,y:f.a.y+(f.b.y-f.a.y)*t,kind:fx('soap_cube_c'),size:3+R()*3,vx:(R()-.5)*160,vy:-120-R()*120,color:[1,1,1,.9],life:.5});}
    },
    update(dt,body){const s=body.soap;if(!s||s.left<=0)return;s.t+=dt;
      // decaying, irregular shedding (not evenly spaced)
      while(s.left>0&&s.t>=s.next){s.left--;s.next=s.t+(.018+R()*.06)*(1+s.t*3);
        alongFaces(body,1,p=>L.addParticle({x:p.x,y:p.y,kind:fx(pick(['soap_cube_a','soap_cube_b','soap_cube_c'])),size:(body.radius<70?8:12)+R()*9,vx:body.vx*.4+(R()-.5)*90,vy:body.vy*.3-30-R()*60,spin:(R()-.5)*9,color:[1,1,1,1],life:1.8+R()*.6,floor:true,bounce:.38,sound:'soap'}));}}
  });

  // 砂 SAND — short trickle, ザンッ, then a LONG サラサラ collapse: the piece erodes from the cut face into
  // grains that pour down and build a pile which slowly settles (the longest 余韻 of all materials).
  const PILE_W=4,pile=new Float32Array(Math.ceil(720/PILE_W));let pileAge=0,flowAcc=0;
  L.clearHooks.push(()=>{pile.fill(0);});
  L.updateHooks.push(dt=>{pileAge+=dt;let any=false;for(let i=0;i<pile.length;i++){if(pile[i]>0){pile[i]*=Math.exp(-dt/7);any=true;}}
    // smooth the pile a little (grains slide)
    if(any)for(let i=1;i<pile.length-1;i++){const d=(pile[i]-(pile[i-1]+pile[i+1])/2)*.08*Math.min(1,dt*60);pile[i]-=d;pile[i-1]+=d/2;pile[i+1]+=d/2;}
    if(flowAcc>0){L.events.emit('flow',{material:'sand',rate:flowAcc/Math.max(dt,.001),x:360});flowAcc=0;}
  });
  L.drawHooks.push(r=>{const pts=[];for(let i=0;i<pile.length;i++)if(pile[i]>.4){pts.push(i);}if(!pts.length)return;
    for(const i of pts){const x=i*PILE_W,h=Math.min(90,pile[i]);r.cap('xsec/sand',[{x,y:L.FLOOR+3-h,shade:0},{x:x+PILE_W+.6,y:L.FLOOR+3-h,shade:0},{x:x+PILE_W+.6,y:L.FLOOR+4,shade:.3},{x,y:L.FLOOR+4,shade:.3}],[0,1,2,0,2,3],2,[1,.96,.9,1]);}});
  base('sand','砂',{hardness:.25,layers:{shell:null,core:{color:'#d8c39c'}},
    init(body){roughen(body,3.5,6);},
    onCut(body,cut){const grunt=body.radius<70;
      for(const child of cut.children){const c=cutLine(child);if(!c)continue;let max=0;for(const p of child.poly)max=Math.max(max,c.side*((p.x-c.a.x)*c.nx+(p.y-c.a.y)*c.ny));
        const dur=(grunt?.55:1)*post('sand')*(.8+R()*.4);child.dissolve={...c,front:-2,max:max+6,speed:(max+8)/dur,delay:.06+R()*.05};child.gScale=.18;child.vx*=.25;child.vy=Math.min(child.vy,0)*.2;child.spin*=.15;}
      L.events.emit('crumble',{material:'sand',count:grunt?4:12,x:body.x,y:body.y});
    },
    update(dt,body){const d=body.dissolve;if(!d)return;if(d.delay>0){d.delay-=dt;return;}const prev=d.front;d.front+=d.speed*dt*(.7+.6*Math.min(1,body.age*2));
      // grains released along the moving front
      const fs=body.poly,count=Math.min(70,Math.round((d.front-prev)*body.radius*.26)+2);let made=0;
      for(let k=0;k<count*3&&made<count;k++){const p=fs[Math.floor(R()*fs.length)],q=fs[Math.floor(R()*fs.length)],t=R(),x=p.x+(q.x-p.x)*t,y=p.y+(q.y-p.y)*t,depth=d.side*((x-d.a.x)*d.nx+(y-d.a.y)*d.ny);
        if(Math.abs(depth-d.front)>6)continue;made++;const w=L.worldPoint(body,{x,y});
        L.addParticle({x:w.x,y:w.y,kind:fx('sand_clump'),size:1.8+R()*2.4,vx:body.vx+(R()-.5)*40,vy:body.vy+10+R()*40,spin:(R()-.5)*4,color:[1,.96,.88,1],life:4,floor:true,bounce:.05,
          onLand:g=>{const i=Math.max(0,Math.min(pile.length-1,Math.round(g.x/PILE_W)));pile[i]+=1.6;if(i>0)pile[i-1]+=.6;if(i<pile.length-1)pile[i+1]+=.6;return false;}});}
      flowAcc+=made;
      if(d.front>=d.max)L.removeBody(body);
    }
  });

  // チョーク CHALK — faint creak, a sharp ポキッ, ragged edge, pieces snap again, crumbs bounce, dust hangs in the air.
  base('chalk','チョーク',{hardness:.6,layers:{shell:null,core:{color:'#e4daf2'}},
    init(body){roughen(body,2.6,7);},
    onCut(body,cut){const grunt=body.radius<70;
      for(const f of cut.faces){const n=grunt?3:7;for(let i=0;i<n;i++){const t=R();L.addParticle({x:f.a.x+(f.b.x-f.a.x)*t,y:f.a.y+(f.b.y-f.a.y)*t,kind:fx(pick(['chalk_crumb_a','chalk_crumb_b'])),size:4+R()*6,vx:(R()-.5)*220,vy:-80-R()*160,spin:(R()-.5)*14,color:[1,1,1,1],life:1.6,floor:true,bounce:.42,sound:'chalk'});}
        // dust: big, slow, lingering
        const m=grunt?2:6;for(let i=0;i<m;i++){const t=R();L.addParticle({x:f.a.x+(f.b.x-f.a.x)*t,y:f.a.y+(f.b.y-f.a.y)*t,kind:fx('chalk_dust'),size:(grunt?14:26)+R()*30,vx:(R()-.5)*60,vy:-20-R()*40,spin:(R()-.5)*.6,g:-8,drag:1.6,color:[1,1,1,.42],life:post('chalk')*(.8+R()*.6)});}}
      L.events.emit('crumble',{material:'chalk',count:grunt?3:9,x:body.x,y:body.y});
      // brittle: big pieces snap once more ~70 ms later (ポキッ…ポキッ)
      if(!grunt)for(const child of cut.children)if(child.area>9000&&child.depth<2)child.snapAt=.06+R()*.06;
    },
    update(dt,body){if(body.snapAt===undefined)return;body.snapAt-=dt;if(body.snapAt>0)return;body.snapAt=undefined;
      const a=R()*Math.PI,r=body.radius,ox=(R()-.5)*r*.4,oy=(R()-.5)*r*.4,c=Math.cos(a)*r*2,s=Math.sin(a)*r*2;
      L.split(body,[{x:body.x+ox-c,y:body.y+oy-s},{x:body.x+ox+c,y:body.y+oy+s}],700);}
  });

  // 吸水スポンジ SPONGE — a LONG squeeze 予兆: it compresses hugely and water oozes out; then a porous ザクッ; drips linger.
  base('sponge','吸水スポンジ',{hardness:.3,squash:2.3,layers:{shell:null,core:{color:'#f4d34a'}},
    onPress(body,hit){body.sponge={drip:0};},
    onCut(body,cut){const grunt=body.radius<70;
      alongFaces(body,grunt?5:16,p=>L.addParticle({x:p.x,y:p.y,kind:fx('sponge_drop'),size:6+R()*8,vx:(R()-.5)*200,vy:-60-R()*160,color:[.85,.95,1,.9],life:1.4,floor:true,bounce:.12,sound:'sponge'}));
      for(const child of cut.children){child.sponge={drip:.05,left:grunt?2:6};child.spin*=.6;}
    },
    update(dt,body){const s=body.sponge;if(!s)return;
      if(body.pressing){const amt=Math.min(1,body.pressing.age/body.pressing.duration);body.tint=[1-amt*.22,1-amt*.2,1-amt*.32,1];s.drip-=dt;
        if(s.drip<=0){s.drip=.07-amt*.055;const n=1+Math.floor(amt*4);for(let i=0;i<n;i++){const p=body.poly[Math.floor(R()*body.poly.length)],w=L.worldPoint(body,{x:p.x*(1+amt*.3),y:p.y*.6});
          L.addParticle({x:w.x,y:w.y,kind:fx('sponge_drop'),size:6+R()*6+amt*6,vx:(R()-.5)*160*amt,vy:30+R()*60,color:[.85,.95,1,.9],life:1.3,floor:true,bounce:.1,sound:'sponge'});}}
        return;}
      if(s.left>0){s.drip-=dt;if(s.drip<=0){s.left--;s.drip=.08+R()*.22;alongFaces(body,1,p=>L.addParticle({x:p.x,y:p.y,kind:fx('sponge_drop'),size:3+R()*4,vx:body.vx*.2,vy:body.vy*.2+30,color:[.85,.95,1,.9],life:1.3,floor:true,bounce:.1,sound:'sponge'}));}}
    }
  });

  // 粒入りスライム BEAD SLIME — the cut does not separate cleanly: stretchy threads hold the halves, pull them back,
  // thin out, and snap (ぷつっ) one by one, spilling beads that bounce and plink.
  const strands=[];
  L.clearHooks.push(()=>{strands.length=0;});
  L.updateHooks.push(dt=>{let stretch=0,live=0;
    for(const s of strands){if(s.dead)continue;const A=L.worldPoint(s.b1,s.p1),B=L.worldPoint(s.b2,s.p2),dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy);s.len=len;
      if(s.b1.removed||s.b2.removed||len>s.max){s.dead=true;const x=(A.x+B.x)/2,y=(A.y+B.y)/2;L.events.emit('release',{material:'beadslime',x,y});
        for(let i=0;i<2+Math.floor(R()*2);i++)L.addParticle({x,y,kind:fx(pick(['bead_a','bead_b','bead_c'])),size:8+R()*5,vx:(R()-.5)*160,vy:-40-R()*120,spin:(R()-.5)*10,color:[1,1,1,1],life:2,floor:true,bounce:.55,sound:'beadslime'});continue;}
      // elastic pull: the halves are reluctant to part
      const k=Math.min(1,len/s.max),acc=380*k*k*dt/Math.max(1,len);s.b1.vx+=dx*acc;s.b1.vy+=dy*acc;s.b2.vx-=dx*acc;s.b2.vy-=dy*acc;
      stretch=Math.max(stretch,k);live++;}
    if(live)L.events.emit('strain',{material:'beadslime',amount:stretch,rate:2});else if(strands.some(s=>s.dead&&!s.reported)){for(const s of strands)s.reported=true;L.events.emit('strain',{material:'beadslime',amount:0,rate:0});}
    for(let i=strands.length-1;i>=0;i--)if(strands[i].dead&&strands[i].reported)strands.splice(i,1);
  });
  L.drawHooks.push(r=>{for(const s of strands){if(s.dead)continue;const A=L.worldPoint(s.b1,s.p1),B=L.worldPoint(s.b2,s.p2),k=Math.min(1,s.len/s.max),w=Math.max(.9,s.w*(1-k*.85));
    // sag in the middle like a real thread of slime
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2+12*(1-k),M={x:mx,y:my};r.line(A,M,w,[.93,.82,1,.78]);r.line(M,B,w,[.93,.82,1,.78]);r.line(A,M,Math.max(.6,w*.35),[1,1,1,.55]);}});
  base('beadslime','粒入りスライム',{hardness:.12,squash:1.6,layers:{shell:null,core:{color:'#e8d6f6'}},
    onCut(body,cut){const grunt=body.radius<70,[c1,c2]=cut.children;
      if(c1&&c2)for(const f of cut.faces){const n=grunt?2:5;for(let i=0;i<n;i++){const t=(i+.5)/n+(R()-.5)*.1,w={x:f.a.x+(f.b.x-f.a.x)*t,y:f.a.y+(f.b.y-f.a.y)*t};
        strands.push({b1:c1,b2:c2,p1:L.localPoint(c1,w),p2:L.localPoint(c2,w),max:(grunt?34:55)+R()*(grunt?30:85),w:(grunt?3:6)+R()*4,len:0});}}
      alongFaces(body,grunt?4:12,p=>L.addParticle({x:p.x,y:p.y,kind:fx(pick(['bead_a','bead_b','bead_c'])),size:8+R()*6,vx:(R()-.5)*240,vy:-80-R()*140,spin:(R()-.5)*10,color:[1,1,1,1],life:2.2,floor:true,bounce:.55,sound:'beadslime'}));
      for(const child of cut.children){child.vx*=.8;child.vy*=.8;child.spin*=.5;}
    }
  });

  // 琥珀糖 KOHAKUTOU — crisp crust ticks, シャリッ, crystal shards spray and tinkle, the jewel interior glints.
  base('kohaku','琥珀糖',{hardness:.7,layers:{shell:{color:'#f0c9a0'},core:{color:'#f39a1e',translucency:.6}},
    onCut(body,cut){const grunt=body.radius<70;
      for(const f of cut.faces){const n=grunt?3:9;for(let i=0;i<n;i++){const t=R();L.addParticle({x:f.a.x+(f.b.x-f.a.x)*t,y:f.a.y+(f.b.y-f.a.y)*t,kind:fx(pick(['kohaku_shard_a','kohaku_shard_b'])),size:(grunt?5:7)+R()*7,vx:(R()-.5)*300,vy:-120-R()*200,spin:(R()-.5)*16,color:[1,1,1,1],life:1.7,floor:true,bounce:.5,sound:'kohaku'});}}
      // a glint along the jewel face
      for(const f of cut.faces)L.addParticle({x:(f.a.x+f.b.x)/2,y:(f.a.y+f.b.y)/2,kind:fx('kohaku_shard_b'),size:grunt?10:18,vx:0,vy:0,spin:0,g:0,color:[1,1,.85,.9],life:.18});
    }
  });
})(window.LAB);
