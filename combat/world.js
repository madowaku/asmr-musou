/* COMBAT LAB world: bodies, cutting, pieces, particles, drawing. Ported from lab/main.js (v0.3) so the
 * material studies, caps and audio work unchanged; the lab itself is not modified. Intact enemies float
 * (no gravity); cut pieces and launched projectiles obey gravity and fall to the floor. */
(function(L){
  'use strict';
  const S=L.slice;
  const W=L.world={bodies:[],particles:[],flashes:[],trails:[],rings:[],texts:[],freeze:0,punch:0,cutCount:0,cutId:0,nextId:1,stroke:1};
  L.bodies=W.bodies;L.time=0;L.frame=0;L.FLOOR=1236;
  // Combat-only: the book-open cap is shown at the cut moment, then closes by 0.8 s as the piece tumbles away.
  // (Pieces are numerous in combat; drawing every cap for its whole life was the main draw cost.) Lab is untouched.
  {const base=L.cap.thetaAt.bind(L.cap);L.cap.thetaAt=age=>base(age)*(age<.45?1:Math.max(0,1-(age-.45)/.35));}
  const config=L.config={maxDepth:3,minPieceArea:10,maxBodies:260,maxParticles:1500,gravity:760};
  let particleCursor=0;const TMP={x:0,y:0,u:0,v:0};
  L.worldPoint=(b,p)=>{const c=Math.cos(b.angle),s=Math.sin(b.angle);return {x:b.x+p.x*c-p.y*s,y:b.y+p.x*s+p.y*c};};
  L.localPoint=(b,p)=>{const c=Math.cos(b.angle),s=Math.sin(b.angle),x=p.x-b.x,y=p.y-b.y;return {x:x*c+y*s,y:-x*s+y*c};};
  L.addParticle=p=>{const q={x:0,y:0,vx:0,vy:0,size:3,angle:L.random()*6.28,spin:(L.random()-.5)*12,life:.65+L.random()*.35,kind:0,color:[1,1,1,1],...p};if(W.particles.length>=config.maxParticles)W.particles[particleCursor++%config.maxParticles]=q;else W.particles.push(q);};
  L.removeBody=b=>{b.removed=true;};

  function worldVertices(b){
    if(b.world&&!b.active&&!b.pressing&&!b.dirty&&(!b.soft||b.soft.sleeping)&&b.wx===b.x&&b.wy===b.y&&b.wa===b.angle&&!b.squash)return b.world;
    const pts=b.soft?b.soft.points:b.poly,c=Math.cos(b.angle),s=Math.sin(b.angle);
    if(!b.world||b.world.length!==pts.length)b.world=pts.map(()=>({x:0,y:0,u:0,v:0,cut:null,e:0}));
    const sq=b.squash||0,d=b.dissolve;
    for(let i=0;i<pts.length;i++){let p=pts[i],px=p.x,py=p.y;
      if(b.pressing){const a=Math.min(1,b.pressing.age/b.pressing.duration),k=L.materials[b.material].squash||1;px*=1+a*.16*k;py*=1-Math.min(.8,a*.23*k);}
      if(sq){px*=1+sq*.35;py*=1-sq*.3;}
      let q;if(b.cap){TMP.x=px;TMP.y=py;TMP.u=p.u;TMP.v=p.v;q=L.cap.skin(b,TMP);}else{TMP.x=px;TMP.y=py;TMP.u=p.u;TMP.v=p.v;q=TMP;}const w=b.world[i]; // no per-vertex allocation
      w.x=b.x+q.x*c-q.y*s;w.y=b.y+q.x*s+q.y*c;w.u=q.u;w.v=q.v;w.cut=i<b.poly.length?b.poly[i].cut:null;w.e=d?d.side*((p.x-d.a.x)*d.nx+(p.y-d.a.y)*d.ny)-d.front:0;}
    b.wx=b.x;b.wy=b.y;b.wa=b.angle;b.dirty=false;return b.world;
  }
  W.currentPoly=b=>worldVertices(b).slice(0,b.poly.length);

  function makeBody(material,poly,options={},parent=null){
    const c=S.centroid(poly),area=S.area(poly);
    const b={id:W.nextId++,material,poly:poly.map(p=>({...p,x:p.x-c.x,y:p.y-c.y})),x:c.x,y:c.y,angle:0,vx:options.vx||0,vy:options.vy||0,spin:options.spin||0,depth:options.depth||0,area,age:0,active:!!options.depth,team:parent?parent.team:options.team||'enemy'};
    b.rootId=parent?parent.rootId:b.id;b.baseTexture=parent?.baseTexture||options.texture;b.lod=parent?.lod||options.lod||'book';b.boss=parent?parent.boss:!!options.boss;
    L.materials[material].init(b,parent);b.meshIndices=b.meshIndices||S.triangulate(b.poly);b.radius=Math.max(...b.poly.map(p=>Math.hypot(p.x,p.y)));return b;
  }
  // Enemy from a v0.3 sprite outline (grunt/boss art), or from an explicit polygon (boss plates).
  W.spawn=(material,x,y,r,opt={})=>{
    if(W.bodies.length>=config.maxBodies)return null;let poly;
    if(opt.poly)poly=opt.poly.map(p=>({x:x+p.x,y:y+p.y,u:p.u,v:p.v,cut:null}));
    else{const key=material+'_'+(opt.variant||(r<60?'grunt':'boss')),full=L.outlines[key].points,out=r<45&&full.length>24?full.filter((_,i)=>i%2===0):full,reach=Math.max(...out.map(p=>Math.hypot(p[0]-.5,p[1]-.5))),k=r/reach;
      poly=out.map(p=>({x:x+(p[0]-.5)*k,y:y+(p[1]-.5)*k,u:p[0],v:p[1],cut:null}));opt.texture=opt.texture||'body/'+key;}
    const b=makeBody(material,poly,opt);Object.assign(b,opt.extra||{});W.bodies.push(b);return b;
  };

  // One fracture transaction (same frame): pieces, material response, events, flash, hit-stop.
  function fracture(body,result,path,speed,opt={}){
    const id=result.id,faces=[];
    for(const poly of result.pieces)for(let i=0;i<poly.length;i++)if(poly[i].cut===id)faces.push({a:{...poly[i]},b:{...poly[(i+1)%poly.length]}});
    const first=path[0],last=path[path.length-1],dx=last.x-first.x,dy=last.y-first.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    const push=opt.push||{x:0,y:0},grunt=body.radius<70;
    const children=result.pieces.map(poly=>{const c=S.centroid(poly),side=Math.sign((c.x-first.x)*nx+(c.y-first.y)*ny)||1,sp=Math.min(380,(grunt?130:80)+speed*.06)*(opt.spread??1);
      const ch=makeBody(body.material,poly,{depth:body.depth+1,vx:body.vx+nx*side*sp+push.x,vy:body.vy+ny*side*sp+push.y-(grunt?150:90),spin:side*Math.min(6,1.2+90/Math.sqrt(S.area(poly)))},body);
      L.cap.init(ch,path,body.lod);ch.x+=nx*side*3;ch.y+=ny*side*3;if(opt.projectile)ch.shard={owner:opt.owner,energy:opt.projectile,born:L.time,gen:(body.chainGen||0)};return ch;});
    const i=W.bodies.indexOf(body);if(i>=0)W.bodies.splice(i,1,...children);
    const length=faces.reduce((s,f)=>s+Math.hypot(f.a.x-f.b.x,f.a.y-f.b.y),0)/2;
    const cut={id,faces,children,speed,length,area:body.area,material:body.material,x:body.x,y:body.y,sourceId:body.id,rootId:body.rootId,depth:body.depth+1,pieces:children.length};
    L.events.emit('strain',{material:body.material,amount:0,rate:0});L.materials[body.material].onCut(body,cut);
    if(!body.depth){L.events.emit('cut',{...cut,faces:faces.map(f=>({a:{x:f.a.x,y:f.a.y},b:{x:f.b.x,y:f.b.y}})),children:children.map(b=>b.id)});L.events.emit('kill',{material:body.material,x:body.x,y:body.y,cause:opt.cause||'cut'});}
    W.freeze=Math.max(W.freeze,opt.stop??(grunt?.022:.05));W.punch=Math.max(W.punch,grunt?.007:.016);
    W.flashes.push({a:faces[0]?.a||first,b:faces[0]?.b||last,life:.05});W.cutCount++;
    if(W.onBreak&&!body.depth)W.onBreak(body,opt);
    return children;
  }
  // Cut `body` along the polyline `path`; if the path only grazes it, cut along a parallel line through it.
  W.cut=(body,path,speed=1200,opt={})=>{
    if(!W.bodies.includes(body)||body.removed||body.depth>=config.maxDepth)return null;
    const poly=opt.outline??W.currentPoly(body),id='cut-'+(++W.cutId);let r=S.splitPath(poly,path,{minArea:config.minPieceArea,cutId:id});
    if(!r.cut){const a=path[0],z=path[path.length-1],dx=z.x-a.x,dy=z.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,t=((body.x-a.x)*ux+(body.y-a.y)*uy),px=a.x+ux*t,py=a.y+uy*t,dd=Math.hypot(body.x-px,body.y-py)||1,o=Math.min(dd,body.radius*.4),cx=body.x-(body.x-px)/dd*o,cy=body.y-(body.y-py)/dd*o,R=body.radius*2.5;
      path=[{x:cx-ux*R,y:cy-uy*R},{x:cx+ux*R,y:cy+uy*R}];r=S.splitPath(poly,path,{minArea:config.minPieceArea,cutId:id});}
    if(!r.cut)return null;r.id=id;return fracture(body,r,path,speed,opt);
  };
  // Shatter = cut along a random line through the body (lightning, impacts, implosions).
  W.shatter=(body,speed=900,opt={})=>{const a=opt.angle??L.random()*Math.PI,R=body.radius*2.5,ox=(L.random()-.5)*body.radius*.3,oy=(L.random()-.5)*body.radius*.3;
    return W.cut(body,[{x:body.x+ox-Math.cos(a)*R,y:body.y+oy-Math.sin(a)*R},{x:body.x+ox+Math.cos(a)*R,y:body.y+oy+Math.sin(a)*R}],speed,opt);};
  L.split=(body,line,speed=900)=>!!W.cut(body,line,speed);

  W.enemies=()=>W.bodies.filter(b=>!b.removed&&!b.active&&b.team==='enemy');
  W.clear=()=>{for(const h of L.clearHooks)h();W.bodies.length=W.particles.length=W.flashes.length=W.trails.length=W.rings.length=W.texts.length=0;W.freeze=W.punch=W.cutCount=0;L.events.clear();};

  W.advance=dt=>{
    for(const b of W.bodies.slice()){b.age+=dt;if(b.cap)b.cap.age+=dt;
      if(b.pressing){b.pressing.age+=dt;const a=Math.min(1,b.pressing.age/b.pressing.duration);L.events.emit('strain',{material:b.material,amount:a,rate:1/b.pressing.duration,x:b.x,y:b.y});if(a>=1){const p=b.pressing;b.pressing=null;b.dirty=true;p.done&&p.done(b);}}
      L.materials[b.material].update(dt,b);}
  };
  W.physics=dt=>{
    let n=0;for(const b of W.bodies){
      if(b.removed)continue;
      if(b.active){b.vy+=config.gravity*(b.gScale??(b.radius<60?1.25:1))*dt;b.vx*=Math.exp(-.25*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.spin*dt;}
      else if(b.flying){b.vy+=config.gravity*.18*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.spin*dt;b.flyT-=dt;if(b.flyT<=0||Math.hypot(b.vx,b.vy)<120){b.flying=false;}}
      else if(b.drift){b.x+=b.drift.x*dt;b.y+=b.drift.y*dt;}
      if(b.squash)b.squash=Math.max(0,b.squash-dt*3);
      const off=b.y-b.radius>1400||b.x<-260||b.x>980||b.y<-400;
      // debris clears quickly so the next formation reads cleanly (sand keeps its slow dissolve)
      const done=b.active&&!b.dissolve&&(b.age>2.6||(b.y>L.FLOOR+30&&b.vy>0));
      if(!off&&!done&&(!b.active||b.age<10))W.bodies[n++]=b;}W.bodies.length=n;
    n=0;for(const p of W.particles){p.life-=dt;if(p.life<=0)continue;p.vy+=(p.g??620)*dt;if(p.drag){const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy*=k;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
      if(p.floor&&p.y>L.FLOOR&&p.vy>0){p.y=L.FLOOR;if(p.onLand&&p.onLand(p)===false)continue;if(p.vy>70){const e=Math.min(1,p.vy/700);p.bounces=(p.bounces||0)+1;if(p.sound&&p.bounces<=2)L.events.emit('impact',{material:p.sound,energy:e*(p.bounces===1?1:.45),size:p.size/10,x:p.x,y:p.y,speed:p.vy});p.vy*=-(p.bounce??.3);p.vx*=.62;p.spin*=.5;}else{p.vy=0;p.vx*=Math.exp(-6*dt);}}
      W.particles[n++]=p;}W.particles.length=n;
    for(const h of L.updateHooks)h(dt);
  };
  W.decay=dt=>{for(const list of [W.flashes,W.trails,W.rings,W.texts]){let n=0;for(const it of list){it.life-=dt;if(it.life>0)list[n++]=it;}list.length=n;}W.punch*=Math.exp(-12*dt);};

  W.drawBodies=r=>{
    for(let pass=0;pass<2;pass++)for(const b of W.bodies){if(b.removed||(pass===0)===!!b.active)continue;
      const world=worldVertices(b);r.mesh(b.baseTexture,world,b.meshIndices,b.tint||[1,1,1,1],b.dissolve?5:0);
      if(L.materials[b.material].draw)L.materials[b.material].draw(r,b);L.cap.draw(r,b);
      if(b.hp>1&&!b.active){const k=b.hp-1;for(let i=0;i<k;i++)r.line({x:b.x-12+i*12,y:b.y-b.radius-10},{x:b.x-4+i*12,y:b.y-b.radius-10},3,[1,1,1,.75]);}
      if(b.marked){const t=L.time*6;r.line({x:b.x-b.radius,y:b.y},{x:b.x+b.radius,y:b.y},1.5,[1,1,.6,.35+.25*Math.sin(t)]);}}
    for(const h of L.drawHooks)h(r);
  };
  W.drawFx=r=>{
    for(const t of W.trails){const a=Math.min(1,t.life/(t.total||.25));r.ribbon(t.a,t.b,Math.max(.8,(t.w||4)*a),[...(t.color||[.85,1,.95]),a*(t.alpha??.75)]);}
    for(const f of W.flashes){const a=Math.min(1,f.life/.03);r.flash(f.a,f.b,12,[1,.85,.95,a*.35]);r.flash(f.a,f.b,3,[1,1,1,a]);}
    for(const g of W.rings){const k=1-g.life/g.total,rad=g.r0+(g.r1-g.r0)*(1-Math.pow(1-k,2));let prev=null;for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,p={x:g.x+Math.cos(a)*rad,y:g.y+Math.sin(a)*rad};if(prev)r.flash(prev,p,g.w||3,[...(g.color||[1,1,1]),(1-k)*(g.alpha??.6)]);prev=p;}}
  };
})(window.LAB);
