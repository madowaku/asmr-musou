(async function(L){
  'use strict';
  const $=id=>document.getElementById(id),S=L.slice,canvas=$('scene');
  let renderer;
  try{await L.loadAssets();renderer=L.createRenderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent=e.message;return;}
  L.renderer=renderer;L.time=0;L.frame=0;
  const config=L.config={maxDepth:3,minPieceArea:8,maxBodies:240,maxParticles:1200,gravity:720};
  const bodies=[],particles=[],strokes=new Map(),pending=[],trails=[],flashes=[],fractures=[],accents=[];
  let capMode=null,onlyBody=null,queuedHorde=0;
  let nextId=1,nextStroke=1,cutId=0,paused=false,stepFrames=0,slow=false,wire=false,freeze=0,punch=0,previous=0,hudAt=0,cutCount=0,lastCut=null;
  let profile=false,profileSamples=[],profileInput=[],profileStages=[],profileLoad={minBodies:Infinity,maxBodies:0,maxParticles:0,cuts:0},replenish=false,refillAt=0,particleCursor=0;
  const recent=[],frameIntervals=[];
  L.worldPoint=(b,p)=>{const c=Math.cos(b.angle),s=Math.sin(b.angle);return {x:b.x+p.x*c-p.y*s,y:b.y+p.x*s+p.y*c};};
  L.localPoint=(b,p)=>{const c=Math.cos(b.angle),s=Math.sin(b.angle),x=p.x-b.x,y=p.y-b.y;return {x:x*c+y*s,y:-x*s+y*c};};
  function worldVertices(b){
    if(b.world&&!b.active&&!b.pressing&&!b.dent&&(!b.soft||b.soft.sleeping))return b.world;
    const points=b.soft?b.soft.points:b.poly,c=Math.cos(b.angle),s=Math.sin(b.angle);
    if(!b.world)b.world=points.map(()=>({x:0,y:0,u:0,v:0,cut:null}));
    for(let i=0;i<points.length;i++){let p=points[i];
      if(b.pressing){const amount=Math.min(1,b.pressing.age/b.pressing.duration);p={...p,x:p.x*(1+amount*.16),y:p.y*(1-amount*.23)};}
      if(b.dent){const d=(p.x-b.dent.x)*b.dent.nx+(p.y-b.dent.y)*b.dent.ny,weight=Math.exp(-d*d/900);p={...p,x:p.x-b.dent.nx*weight*9,y:p.y-b.dent.ny*weight*9};}
      p=L.cap.skin(b,p);const w=b.world[i];w.x=b.x+p.x*c-p.y*s;w.y=b.y+p.x*s+p.y*c;w.u=p.u;w.v=p.v;w.cut=i<b.poly.length?b.poly[i].cut:null;}
    return b.world;
  }
  function currentPoly(b){return worldVertices(b).slice(0,b.poly.length);}
  function makeBody(material,poly,options={},parent=null){
    const c=S.centroid(poly),area=S.area(poly),b={id:nextId++,rootId:parent?parent.rootId:nextId-1,material,poly:poly.map(p=>({...p,x:p.x-c.x,y:p.y-c.y})),x:c.x,y:c.y,angle:0,vx:options.vx||0,vy:options.vy||0,spin:options.spin||0,depth:options.depth||0,area,radius:Math.sqrt(area/Math.PI),age:0,active:!!options.depth,lastStroke:options.lastStroke||0,lastIndex:options.lastIndex||0};
    b.baseTexture=parent?.baseTexture||options.texture||'body/'+material+'_boss';b.boss=parent?parent.boss:options.boss!==false;b.lod=parent?.lod||options.lod||'book';L.materials[material].init(b,parent);b.meshIndices=b.meshIndices||S.triangulate(b.poly);b.radius=Math.max(...b.poly.map(p=>Math.hypot(p.x,p.y)));return b;
  }
  function spawn(material='wax',x=360,y=645,r=195,options={}){
    if(bodies.length>=config.maxBodies)return null;
    const variant=options.variant||(r<60?'grunt':'boss'),key=material+'_'+variant,full=L.outlines[key].points,outline=r<45&&full.length>24?full.filter((_,i)=>i%2===0):full;/* ~50px mob grunts: half the outline vertices, same silhouette at that size; halves slicing + cap cost */
    // r denotes silhouette radius, not transparent sprite framing.
    const reach=Math.max(...outline.map(p=>Math.hypot(p[0]-.5,p[1]-.5))),scale=r/reach;
    const poly=outline.map(p=>({x:x+(p[0]-.5)*scale,y:y+(p[1]-.5)*scale,u:p[0],v:p[1],cut:null}));
    const b=makeBody(material,poly,{texture:'body/'+key,boss:variant==='boss',lod:options.lod||'book'});bodies.push(b);return b;
  }
  const hordeLine={a:{x:35,y:760},b:{x:685,y:760}};
  let hordeLod='book';
  // Researched materials first; the selector's material leads so each study can be tested as a mob.
  function hordeMaterials(){const sel=$('material').value,base=['wax','jelly'];return base.includes(sel)?[sel,...base.filter(m=>m!==sel)]:[sel,...base];}
  function horde(n=40,clearFirst=true){
    if(clearFirst)clear();n=Math.max(1,Math.min(80,Math.round(n)));const placed=[];
    // 無双 mob: a dense, jittered hex-packed crowd (a scattered field only gave ~8 hits per swipe).
    // Rows fill outward from the screen middle so N=40..80 always forms one thick band a single swipe can rake through.
    const mats=hordeMaterials(),cell=58,rows=[];for(let k=0;k<14;k++)rows.push(k%2?-(k+1>>1):k>>1);
    let i=0;for(const row of rows){if(i>=n)break;const y=700+row*cell*.86;if(y<330||y>1060)continue;
      for(let col=0;col<12&&i<n;col++){const x=58+col*cell+(row&1?cell/2:0)+(L.random()-.5)*14;if(x>670)continue;const r=23+L.random()*9;
        spawn(mats[i%mats.length],x,y+(L.random()-.5)*14,r,{variant:'grunt',lod:hordeLod});i++;}}
    $('hint').textContent='群れを、一振りでまとめて斬る。';
  }
  function clear(){bodies.length=particles.length=trails.length=flashes.length=pending.length=fractures.length=accents.length=0;L.capture.reset();strokes.clear();freeze=punch=cutCount=0;lastCut=null;L.events.clear();$('status').textContent='';}
  L.addParticle=p=>{const particle={x:0,y:0,vx:0,vy:0,size:3,angle:L.random()*6.28,spin:(L.random()-.5)*12,life:.65+L.random()*.35,kind:0,color:[1,1,1,1],...p};if(particles.length>=config.maxParticles){particles[particleCursor++%config.maxParticles]=particle;}else particles.push(particle);};
  function nearPath(body,path){const radius=body.radius+(body.soft?Math.max(8,body.soft.amplitude*2):0);for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((body.x-a.x)*dx+(body.y-a.y)*dy)/den)):0;if((body.x-a.x-dx*t)**2+(body.y-a.y-dy*t)**2<=radius*radius)return true;}return false;}
  function boundsOverlap(poly,path){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of path){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}return poly.some(p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY)||!(Math.max(...poly.map(p=>p.x))<minX||Math.min(...poly.map(p=>p.x))>maxX||Math.max(...poly.map(p=>p.y))<minY||Math.min(...poly.map(p=>p.y))>maxY);}
  // One transaction: children, particles, material response, event, stop, punch.
  function fracture(body,result,stroke,path){
    const id=result.id,faces=[];
    for(const poly of result.pieces)for(let i=0;i<poly.length;i++)if(poly[i].cut===id)faces.push({a:{...poly[i]},b:{...poly[(i+1)%poly.length]}});
    const first=path[0],last=path[path.length-1],dx=last.x-first.x,dy=last.y-first.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    const children=result.pieces.map(poly=>{
      const c=S.centroid(poly),side=Math.sign((c.x-first.x)*nx+(c.y-first.y)*ny)||1,grunt=body.radius<70,speed=Math.min(grunt?340:260,(grunt?110:70)+stroke.speed*(grunt?.07:.055));
      const child=makeBody(body.material,poly,{depth:body.depth+1,vx:body.vx+nx*side*speed+dx/len*speed*.22,vy:body.vy+ny*side*speed+dy/len*speed*.22-(grunt?170:100),spin:side*Math.min(5.4,1.15+90/Math.sqrt(S.area(poly))),lastStroke:stroke.id,lastIndex:stroke.points.length-1},body);
      // Open a subpixel gap on the fracture frame; clear face bands are visible now.
      L.cap.init(child,path,capMode||body.lod);child.x+=nx*side*3;child.y+=ny*side*3;child.lastIndex=stroke.points[stroke.points.length-1].seq??stroke.points.length-1;child.lastPoint={...stroke.points[stroke.points.length-1]};return child;
    });
    bodies.splice(bodies.indexOf(body),1,...children);
    for(const debris of result.debris){const c=S.centroid(debris);L.addParticle({x:c.x,y:c.y,size:Math.max(1,Math.sqrt(S.area(debris))),vx:nx*90,vy:ny*90-60,kind:body.material==='wax'?0:1,color:body.material==='wax'?[1,.83,.56,1]:[.35,1,.85,.9]});}
    const length=faces.reduce((s,f)=>s+Math.hypot(f.a.x-f.b.x,f.a.y-f.b.y),0)/2;
    const cut={id,faces,children,speed:stroke.speed,length,area:body.area,material:body.material,x:body.x,y:body.y,sourceId:body.id,rootId:body.rootId,depth:body.depth+1,pieces:children.length};
    L.capture.cut();L.events.emit('strain',{material:body.material,amount:0,rate:0});L.materials[body.material].onCut(body,cut);L.events.emit('cut',{...cut,faces:faces.map(f=>({a:{x:f.a.x,y:f.a.y},b:{x:f.b.x,y:f.b.y}})),children:children.map(b=>b.id),waveManaged:!!stroke.wave,waveId:stroke.wave,scheduledDt:stroke.dt});L.events.emit('kill',{material:body.material,x:body.x,y:body.y,rootId:body.rootId,waveManaged:!!stroke.wave,waveId:stroke.wave});
    freeze=Math.max(freeze,body.lod==='strip'?.025+Math.min(.015,body.area/5000*.015):.045+Math.min(.025,body.area/100000*.025));
    punch=Math.max(punch,body.lod==='strip'?.008:.018);flashes.push({a:faces[0]?.a||first,b:faces[0]?.b||last,life:.034,material:body.material});cutCount++;if(profile)profileLoad.cuts++;
    lastCut={id,sourceId:body.id,rootId:body.rootId,pieces:children.length,faces,frame:L.frame,speed:stroke.speed,time:L.time};
  }
  function processStroke(stroke){
    const begin=performance.now(),hits=[],paths=new Map();if(stroke.points.length<2)return;
    for(const body of bodies.slice()){
      if(body.queued||body.depth>=config.maxDepth||bodies.length>=config.maxBodies-8||stroke.speed<(body.material==='wax'?240:100))continue;
      const continued=body.lastStroke===stroke.id,key=continued?body.lastIndex:'whole';
      if(!paths.has(key)){const tail=continued?stroke.points.filter((p,i)=>(p.seq??i)>body.lastIndex):stroke.points;paths.set(key,S.resample(continued?[body.lastPoint,...tail]:tail,2.5));}
      const path=paths.get(key);if(path.length<2||!nearPath(body,path))continue;
      const poly=currentPoly(body);if(!boundsOverlap(poly,path))continue;
      const id='cut-'+(++cutId);let result;
      if(body.lod==='strip')for(let i=1;i<path.length;i++){if(!nearPath(body,[path[i-1],path[i]]))continue;const r=S.splitPath(poly,[path[i-1],path[i]],{minArea:config.minPieceArea,cutId:id});if(r.cut){result=r;break;}}
      result=result||S.splitPath(poly,path,{minArea:config.minPieceArea,cutId:id});
      // Blade magnetism (無双): a stroke that grazes past a body still cuts it, along a line parallel to the
      // nearest blade segment, pulled into the body. Reach grows with swipe speed. Without it a fast rake
      // through a crowd misses everything between the exact pixel paths.
      if(!result.cut){const reach=Math.min(34,10+stroke.speed*.006);let best=null;
        for(let i=1;i<path.length;i++){const a=path[i-1],q=path[i],dx=q.x-a.x,dy=q.y-a.y,den=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((body.x-a.x)*dx+(body.y-a.y)*dy)/den)),px=a.x+dx*t,py=a.y+dy*t,d=Math.hypot(body.x-px,body.y-py);if(!best||d<best.d)best={d,ux:dx/Math.sqrt(den),uy:dy/Math.sqrt(den),px,py};}
        if(best&&best.d<body.radius+reach){const nx=(body.x-best.px)/(best.d||1),ny=(body.y-best.py)/(best.d||1),o=Math.min(best.d,body.radius*.45),cx=body.x-nx*o,cy=body.y-ny*o,L2=body.radius*2.4;
          const line=[{x:cx-best.ux*L2,y:cy-best.uy*L2},{x:cx+best.ux*L2,y:cy+best.uy*L2}];result=S.splitPath(poly,line,{minArea:config.minPieceArea,cutId:id});if(result.cut)result.magnet=true;}}
      if(!result.cut||result.pieces.length<1)continue;result.id=id;body.queued=true;hits.push({body,result,path});
    }
    if(hits.length){
      const from=stroke.points[0],to=stroke.points.at(-1),dir={x:to.x-from.x,y:to.y-from.y};
      const path=S.resample(stroke.points,2.5),curved=path.length>2;
      function along(body){let best=Infinity,position=0,total=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((body.x-a.x)*dx+(body.y-a.y)*dy)/(len*len||1))),d=(body.x-a.x-dx*t)**2+(body.y-a.y-dy*t)**2;if(d<best){best=d;position=total+t*len;}total+=len;}return position;}
      const coordinates=hits.map(h=>({id:h.body.id,material:h.body.material,x:curved?along(h.body):h.body.x,y:curved?0:h.body.y}));
      const plan=L.timing.plan(coordinates,curved?{from:{x:0,y:0},to:{x:1,y:0}}:{from,to}).map(k=>{const h=hits.find(h=>h.body.id===k.id);return {...k,x:h.body.x,y:h.body.y};});
      const wave='wave-'+stroke.id,lead=hits.length===1&&hits[0].body.material==='jelly'?L.timing.profile('jelly').pre.min:0;
      const end=Math.max(...plan.map(k=>k.dt))/1000;
      fractures.push({at:L.time+lead,announce:{kills:plan.map(({material,x,y,dt})=>({material,x,y,dt})),dir,id:wave},path:stroke.points,count:hits.length});
      for(const k of plan){const hit=hits.find(h=>h.body.id===k.id);if(!hit)continue;const len=Math.hypot(dir.x,dir.y)||1;
        if(hit.body.material==='jelly'){const p=L.localPoint(hit.body,from);hit.body.dent={...p,nx:-dir.y/len,ny:dir.x/len};hit.body.world=null;}
        fractures.push({...hit,at:L.time+lead+k.dt/1000,stroke:{...stroke,wave:hits.length>1?wave:null,dt:k.dt}});
      }
      for(let i=1;i<stroke.points.length;i++)trails.push({a:stroke.points[i-1],b:stroke.points[i],life:lead+end+.24,total:lead+end+.24});
      if(hits.length>=13){/* accent spans the first..last broken body, not the stroke endpoints (a zig-zag starts and ends on the same side) */const ordered=plan.slice().sort((a,b)=>a.dt-b.dt),f=ordered[0],z=ordered.at(-1);accents.push({at:L.time+lead+end,age:-1,from:{x:f.x,y:f.y},to:{x:z.x,y:z.y},material:hits[0].body.material,count:hits.length});}
      stroke.didCut=true;
    }
    if(profile)profileInput.push(performance.now()-begin);
  }
  function press(stroke){
    if(stroke.pressed||stroke.didCut)return;const hit=stroke.points[Math.floor(stroke.points.length/2)];
    for(let i=bodies.length-1;i>=0;i--){const body=bodies[i];if(!body.queued&&S.contains(currentPoly(body),hit)){
      body.pressing={age:0,duration:L.timing.duration(body.material,'pre')||.55,hit};body.world=null;L.materials[body.material].onPress(body,L.localPoint(body,hit));stroke.pressed=true;break;
    }}
  }
  function advanceMaterials(dt){
    for(const b of bodies.slice()){
      b.age+=dt;if(b.cap)b.cap.age+=dt;
      if(b.pressing){const p=b.pressing;p.age+=dt;const amount=Math.min(1,p.age/p.duration);L.events.emit('strain',{material:b.material,amount,rate:1/p.duration,x:b.x,y:b.y});
        if(amount>=1){b.pressing=null;b.world=null;processStroke({id:nextStroke++,points:[{x:b.x-b.radius*1.5,y:b.y-30},{x:b.x+b.radius*1.5,y:b.y+30}],speed:1600,distance:1000});}
      }else if(b.dent)L.events.emit('strain',{material:b.material,amount:.6,rate:2,x:b.x,y:b.y});
      L.materials[b.material].update(dt,b);
    }
  }
  function waveQueue(){
    fractures.sort((a,b)=>a.at-b.at);while(fractures.length&&fractures[0].at<=L.time+1e-8){const q=fractures.shift();
      if(q.announce){if(q.count>1)L.events.emit('wave',q.announce);L.events.emit('horde',{count:q.count,span_ms:Math.max(...q.announce.kills.map(k=>k.dt)),waveManaged:true});}
      else if(bodies.includes(q.body))fracture(q.body,q.result,q.stroke,q.path);
    }
    for(const a of accents)if(a.age<0&&L.time>=a.at){a.age=0;for(let i=0;i<36;i++){const t=L.random();L.addParticle({x:a.from.x+(a.to.x-a.from.x)*t,y:a.from.y+(a.to.y-a.from.y)*t,kind:a.material==='wax'?0:L.fxSlots.sponge_drop,size:4+L.random()*8,vx:(L.random()-.5)*280,vy:-100-L.random()*180,life:1.2+Math.log2(a.count)*.12});}}
  }

  function point(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.x)*720/r.width,y=(e.clientY-r.y)*1280/r.height;return {x:(x-360)/(1+punch)+360,y:(y-640)/(1+punch)+640};}
  function down(e){if(e.button!==0&&e.pointerType==='mouse')return;if(L.capture.replaying)return;L.audio.unlock?.();canvas.setPointerCapture(e.pointerId);const p={...point(e),seq:0};strokes.set(e.pointerId,{id:nextStroke++,nextSeq:1,points:[p],started:performance.now(),lastTime:performance.now(),distance:0,speed:0,dirty:false,pressed:false,didCut:false});e.preventDefault();}
  function move(e){const s=strokes.get(e.pointerId);if(!s)return;const events=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const ev of events.length?events:[e]){const p=point(ev),last=s.points[s.points.length-1],d=Math.hypot(p.x-last.x,p.y-last.y);if(d<1)continue;p.seq=s.nextSeq++;s.points.push(p);s.distance+=d;const elapsed=Math.max(.016,(performance.now()-s.lastTime)/1000);s.speed=Math.min(6000,d/elapsed);s.lastTime=performance.now();s.dirty=true;trails.push({a:last,b:p,life:.2,speed:s.speed});if(s.points.length>160)s.points=S.resample(s.points,2);}}
  function up(e,cancelled=false){const s=strokes.get(e.pointerId);if(!s)return;if(!cancelled){move(e);s.ended=true;s.dirty=true;pending.push(s);}strokes.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',e=>up(e));canvas.addEventListener('pointercancel',e=>up(e,true));canvas.addEventListener('lostpointercapture',e=>strokes.delete(e.pointerId));window.addEventListener('blur',()=>strokes.clear());
  document.addEventListener('visibilitychange',()=>{strokes.clear();previous=0;});
  function physics(dt){
    let n=0;for(const b of bodies){
      if(b.active&&!b.queued){b.vy+=config.gravity*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.spin*dt;b.vx*=Math.exp(-.3*dt);
        if(b.boss){const c=Math.cos(b.angle),s=Math.sin(b.angle);let bottom=-Infinity;for(const p of b.poly)bottom=Math.max(bottom,b.y+p.x*s+p.y*c);
          if(bottom>1080&&b.vy>0){const speed=b.vy;b.y-=bottom-1080;if(!b.bounced){b.vy*=-.23;b.spin*=.35;b.bounced=true;}else{b.vy=0;b.spin=0;b.vx*=.65;}
            if(speed>30){L.events.emit('impact',{material:b.material,x:b.x,y:1080,speed,area:b.area});L.materials[b.material].onImpact(b,{speed,x:b.x,y:1080});}}
        }
      }
      if(b.y-b.radius<1400&&(!b.active||b.age<12))bodies[n++]=b;
    }bodies.length=n;
    n=0;for(const p of particles){p.life-=dt;if(p.life<=0)continue;p.vy+=620*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;particles[n++]=p;}particles.length=n;
  }
  function draw(){
    renderer.begin();
    // Subtle WebGL laboratory guides; no Canvas2D scene drawing.
    renderer.line({x:46,y:1117},{x:674,y:1117},1,[.46,.66,.58,.19]);
    // Flying pieces are closer to the camera than the intact crowd: draw intact bodies first.
    for(let pass=0;pass<2;pass++)for(const b of bodies){
      if((pass===0)===!!b.active)continue;
      if(onlyBody&&b.id!==onlyBody)continue;const world=worldVertices(b);
      renderer.mesh(b.baseTexture||b.material+'_body',world,b.meshIndices);
      if(L.materials[b.material].draw)L.materials[b.material].draw(renderer,b);
      L.cap.draw(renderer,b);
      if(wire){for(let i=0;i<b.meshIndices.length;i+=3)for(let j=0;j<3;j++)renderer.line(world[b.meshIndices[i+j]],world[b.meshIndices[i+(j+1)%3]],.8,[.8,1,.4,.35]);for(let i=0;i<b.poly.length;i++)renderer.line(world[i],world[(i+1)%b.poly.length],b.poly[i].cut?2.5:1,b.poly[i].cut?[1,.4,.3,1]:[.8,1,.7,.7]);}
    }
    for(const t of trails){const a=Math.min(1,t.life/(t.total||.2));renderer.ribbon(t.a,t.b,Math.max(.7,3.3*a),[.85,1,.9,a*.68]);}
    for(const f of flashes){renderer.flash(f.a,f.b,12,[1,.83,.94,Math.min(1,f.life/.02)*.35]);renderer.flash(f.a,f.b,3,[1,1,1,Math.min(1,f.life/.02)]);}
    for(const a of accents)if(a.age>=0&&a.age<.65){const cx=(a.from.x+a.to.x)/2,cy=(a.from.y+a.to.y)/2,theta=Math.atan2(a.to.y-a.from.y,a.to.x-a.from.x),len=Math.hypot(a.to.x-a.from.x,a.to.y-a.from.y)*.5;let prev=null;for(let i=0;i<=48;i++){const t=i/48*Math.PI*2,x=Math.cos(t)*(len+50*a.age),y=Math.sin(t)*(12+135*a.age),p={x:cx+x*Math.cos(theta)-y*Math.sin(theta),y:cy+x*Math.sin(theta)+y*Math.cos(theta)};if(prev)renderer.flash(prev,p,2.5,[.94,.95,1,(1-a.age/.65)*.35]);prev=p;}}
    renderer.render(particles,L.time,punch,slow);
  }
  function frame(ms){
    const elapsed=previous?Math.min(.05,(ms-previous)/1000):1/60;previous=ms;frameIntervals.push(elapsed);if(frameIntervals.length>90)frameIntervals.shift();
    const start=performance.now();L.frame++;if(queuedHorde){const inputs=pending.splice(0);horde(queuedHorde);pending.push(...inputs);queuedHorde=0;}if(L.capture.replaying){L.capture.play(renderer,elapsed);requestAnimationFrame(frame);return;}
    if(replenish&&L.time>=refillAt){horde(40,false);if(bodies.length>120)bodies.splice(0,bodies.length-120);refillAt=L.time+.45;}
    const advancing=!paused||stepFrames>0;
    if(advancing){
      for(const s of strokes.values()){if(s.dirty)s.dirty=false;if(!s.pressed&&s.distance<12&&(performance.now()-s.started)>180)press(s);}
      while(pending.length){const s=pending.shift();processStroke(s);if(s.distance<20||s.speed<240)press(s);}
      const realDt=stepFrames>0?1/60:elapsed,dt=realDt*(slow?.25:1);L.time+=dt;
      // Wave clock and material response advance even during translation hit-stop.
      advanceMaterials(dt);waveQueue();
      if(freeze>0)freeze=Math.max(0,freeze-realDt);else physics(dt);
      for(const a of accents)if(a.age>=0)a.age+=dt;
      punch*=Math.exp(-12*realDt);
      for(const list of [trails,flashes]){let n=0;for(const item of list){item.life-=dt;if(item.life>0)list[n++]=item;}list.length=n;}
      if(stepFrames>0)stepFrames--;
    }
    const drawStart=performance.now();draw();if(advancing)L.capture.sample(renderer);const cost=performance.now()-start;recent.push(cost);if(recent.length>180)recent.shift();
    if(profile){profileSamples.push(cost);profileStages.push({total:cost,update:drawStart-start,draw:performance.now()-drawStart,bodies:bodies.length,particles:particles.length});profileLoad.minBodies=Math.min(profileLoad.minBodies,bodies.length);profileLoad.maxBodies=Math.max(profileLoad.maxBodies,bodies.length);profileLoad.maxParticles=Math.max(profileLoad.maxParticles,particles.length);}
    if(ms-hudAt>250){hudAt=ms;const sorted=recent.slice().sort((a,b)=>a-b),avg=recent.reduce((a,b)=>a+b,0)/recent.length,fps=frameIntervals.length/frameIntervals.reduce((a,b)=>a+b,0);$('metrics').textContent=`${fps.toFixed(0)} fps · JS ${avg.toFixed(2)} / p95 ${sorted[Math.floor(sorted.length*.95)].toFixed(2)} ms · ${particles.length} 粒 · ${bodies.length} 片`;$('status').textContent=cutCount?`${cutCount} CUT${cutCount>1?'S':''} · ${bodies.length} PIECES`:'';}
    requestAnimationFrame(frame);
  }
  function setButton(id,value){$(id).setAttribute('aria-pressed',String(value));}
  $('spawn').onclick=()=>{spawn($('material').value,360,620,140);};
  $('horde').onclick=()=>horde(Number($('count').value));
  $('reset').onclick=()=>{clear();spawn($('material').value);};
  $('material').onchange=()=>{clear();spawn($('material').value);$('hint').textContent=$('material').value==='wax'?'すっと斬る。そっと触れて、殻を割る。':'斬った面から、ぷるぷるが伝わる。';};
  $('slow').onclick=()=>{slow=!slow;setButton('slow',slow);};
  $('pause').onclick=()=>{paused=!paused;setButton('pause',paused);};
  $('step').onclick=()=>{paused=true;stepFrames=1;setButton('pause',true);};
  $('wire').onclick=()=>{wire=!wire;setButton('wire',wire);};
  $('sound').onclick=()=>{L.audio.unlock();const on=L.audio.toggle();$('sound').textContent='音 '+(on?'ON':'OFF');setButton('sound',on);};
  window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;const key=e.key.toLowerCase(),ids={n:'spawn',h:'horde',s:'slow',' ':'pause','.':'step',d:'wire',r:'record',l:'replay'};if(ids[key]){$(ids[key]).click();e.preventDefault();}if(key==='1'||key==='2'){$('material').value=key==='1'?'wax':'jelly';$('material').onchange();}});
  $('record').onclick=()=>L.capture.record(canvas);$('replay').onclick=()=>L.capture.startReplay();
  L.test={
    capMode(mode){capMode=mode;},hordeLod(mode){hordeLod=mode;},
    capPixels(){const result=[];renderer.setDebug(true);for(const b of bodies.filter(b=>b.cap)){onlyBody=b.id;draw();const px=renderer.pixels();let cap=0,skin=0;for(let i=0;i<px.length;i+=4){if(px[i]>200&&px[i+2]<10)cap++;else if(px[i+2]>200&&px[i]<10)skin++;}result.push({id:b.id,cap,skin,ratio:cap/(cap+skin)});}onlyBody=null;renderer.setDebug(false);draw();return result;},
    clear,spawn,horde,hordeLine,hordeQueued(n){queuedHorde=n;},
    getState(){return {webgl2:renderer.gl instanceof WebGL2RenderingContext,frame:L.frame,time:L.time,paused,slow,freeze,punch,cutCount,lastCut,queue:fractures.length,capture:L.capture.stats(),particles:particles.length,assets:L.assetStatus,bodies:bodies.map(b=>({id:b.id,rootId:b.rootId,material:b.material,depth:b.depth,x:b.x,y:b.y,angle:b.angle,vy:b.vy,cap:b.cap?{age:b.cap.age,lod:b.cap.lod,vertices:b.capVertices}:null,area:b.area,poly:currentPoly(b),soft:b.soft?{age:b.soft.age,amplitude:b.soft.amplitude,points:b.soft.points.map(p=>({x:p.x,y:p.y,rx:p.rx,ry:p.ry,face:p.face}))}:null,crack:b.wax?{age:b.wax.age,shown:b.wax.shown,edges:b.wax.edges.length,peeled:b.wax.cells.filter(c=>c.peeled).length}:null})),events:L.events.history.slice()};},
    profile(on){if(on){profileSamples=[];profileInput=[];profileStages=[];profileLoad={minBodies:Infinity,maxBodies:0,maxParticles:0,cuts:0};}profile=on;return {samples:profileSamples,inputSamples:profileInput,stages:profileStages,load:profileLoad};},
    replenish(on){replenish=on;refillAt=L.time+.45;},
    setPaused(on){paused=on;setButton('pause',on);},
    // Same queued input processing as Pointer Events; used only for geometry stress.
    path(points,speed=2000){pending.push({id:nextStroke++,points,speed,distance:1000,ended:true});}
  };
  L.ready=true;spawn();requestAnimationFrame(frame);
})(window.LAB);
