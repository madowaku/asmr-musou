(async function(L){
  'use strict';
  const $=id=>document.getElementById(id),S=L.slice,canvas=$('scene');
  let renderer;
  try{await L.loadAssets();renderer=L.createRenderer(canvas);}catch(e){$('error').hidden=false;$('error').textContent=e.message;return;}
  L.renderer=renderer;L.time=0;L.frame=0;
  const config=L.config={maxDepth:3,minPieceArea:8,maxBodies:240,maxParticles:1200,gravity:250};
  const bodies=[],particles=[],strokes=new Map(),pending=[],trails=[],flashes=[];
  let nextId=1,nextStroke=1,cutId=0,paused=false,stepFrames=0,slow=false,wire=false,freeze=0,punch=0,previous=0,hudAt=0,cutCount=0,lastCut=null;
  let profile=false,profileSamples=[],profileInput=[],profileStages=[],profileLoad={minBodies:Infinity,maxBodies:0,maxParticles:0,cuts:0},replenish=false,refillAt=0,particleCursor=0;
  const recent=[],frameIntervals=[];
  L.worldPoint=(b,p)=>{const c=Math.cos(b.angle),s=Math.sin(b.angle);return {x:b.x+p.x*c-p.y*s,y:b.y+p.x*s+p.y*c};};
  L.localPoint=(b,p)=>{const c=Math.cos(b.angle),s=Math.sin(b.angle),x=p.x-b.x,y=p.y-b.y;return {x:x*c+y*s,y:-x*s+y*c};};
  function worldVertices(b){
    if(b.world&&!b.active&&(!b.soft||b.soft.sleeping))return b.world;
    const points=b.soft?b.soft.points:b.poly,c=Math.cos(b.angle),s=Math.sin(b.angle);
    if(!b.world)b.world=points.map(()=>({x:0,y:0,u:0,v:0,cut:null}));
    for(let i=0;i<points.length;i++){const p=points[i],w=b.world[i];w.x=b.x+p.x*c-p.y*s;w.y=b.y+p.x*s+p.y*c;w.u=p.u;w.v=p.v;w.cut=i<b.poly.length?b.poly[i].cut:null;}
    return b.world;
  }
  function currentPoly(b){return worldVertices(b).slice(0,b.poly.length);}
  function makeBody(material,poly,options={},parent=null){
    const c=S.centroid(poly),area=S.area(poly),b={id:nextId++,rootId:parent?parent.rootId:nextId-1,material,poly:poly.map(p=>({...p,x:p.x-c.x,y:p.y-c.y})),x:c.x,y:c.y,angle:0,vx:options.vx||0,vy:options.vy||0,spin:options.spin||0,depth:options.depth||0,area,radius:Math.sqrt(area/Math.PI),age:0,active:!!options.depth,lastStroke:options.lastStroke||0,lastIndex:options.lastIndex||0};
    L.materials[material].init(b,parent);b.meshIndices=b.meshIndices||S.triangulate(b.poly);b.radius=Math.max(...b.poly.map(p=>Math.hypot(p.x,p.y)));return b;
  }
  function spawn(material='wax',x=360,y=645,r=155){
    if(bodies.length>=config.maxBodies)return null;const poly=[],n=r<50?12:32;
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);let px,py;if(material==='wax'){px=Math.sign(c)*Math.pow(Math.abs(c),.78)*r;py=Math.sign(s)*Math.pow(Math.abs(s),.78)*r*.93;}else{px=c*r*(1+.1*s);py=s*r*.9;}
      poly.push({x:x+px,y:y+py,u:px/(2*r)+.5,v:py/(2*r)+.5,cut:null});}
    const b=makeBody(material,poly);bodies.push(b);return b;
  }
  const hordeLine={a:{x:45,y:360},b:{x:675,y:1200}};
  function horde(n=40,clearFirst=true){
    if(clearFirst)clear();n=Math.max(1,Math.min(80,Math.round(n)));const columns=Math.ceil(n/2),dx=540,dy=720,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    for(let i=0;i<n;i++){const row=i%2,j=Math.floor(i/2),t=(j+.24+row*.5)/columns,offset=(row?1:-1)*23;spawn(i%3?'jelly':'wax',90+dx*t+nx*offset,420+dy*t+ny*offset,26+(i*13%9));}
    $('hint').textContent='群れは斜めの密集列。左上から右下へ、一息で。';
  }
  function clear(){bodies.length=particles.length=trails.length=flashes.length=pending.length=0;strokes.clear();freeze=punch=cutCount=0;lastCut=null;L.events.clear();$('status').textContent='';}
  L.addParticle=p=>{const particle={x:0,y:0,vx:0,vy:0,size:3,angle:L.random()*6.28,spin:(L.random()-.5)*12,life:.65+L.random()*.35,kind:0,color:[1,1,1,1],...p};if(particles.length>=config.maxParticles){particles[particleCursor++%config.maxParticles]=particle;}else particles.push(particle);};
  function nearPath(body,path){const radius=body.radius+(body.soft?Math.max(8,body.soft.amplitude*2):0);for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((body.x-a.x)*dx+(body.y-a.y)*dy)/den)):0;if((body.x-a.x-dx*t)**2+(body.y-a.y-dy*t)**2<=radius*radius)return true;}return false;}
  function boundsOverlap(poly,path){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of path){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}return poly.some(p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY)||!(Math.max(...poly.map(p=>p.x))<minX||Math.min(...poly.map(p=>p.x))>maxX||Math.max(...poly.map(p=>p.y))<minY||Math.min(...poly.map(p=>p.y))>maxY);}
  // One transaction: children, particles, material response, event, stop, punch.
  function fracture(body,result,stroke,path){
    const id='cut-'+(++cutId),faces=[];
    for(const poly of result.pieces)for(let i=0;i<poly.length;i++)if(poly[i].cut===id)faces.push({a:{...poly[i]},b:{...poly[(i+1)%poly.length]}});
    const first=path[0],last=path[path.length-1],dx=last.x-first.x,dy=last.y-first.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    const children=result.pieces.map(poly=>{
      const c=S.centroid(poly),side=Math.sign((c.x-first.x)*nx+(c.y-first.y)*ny)||1,speed=Math.min(160,35+stroke.speed*.035);
      const child=makeBody(body.material,poly,{depth:body.depth+1,vx:body.vx+nx*side*speed,vy:body.vy+ny*side*speed-25,spin:side*.12,lastStroke:stroke.id,lastIndex:stroke.points.length-1},body);
      // Open a subpixel gap on the fracture frame; clear face bands are visible now.
      child.x+=nx*side*1.5;child.y+=ny*side*1.5;child.lastIndex=stroke.points[stroke.points.length-1].seq??stroke.points.length-1;child.lastPoint={...stroke.points[stroke.points.length-1]};return child;
    });
    bodies.splice(bodies.indexOf(body),1,...children);
    for(const debris of result.debris){const c=S.centroid(debris);L.addParticle({x:c.x,y:c.y,size:Math.max(1,Math.sqrt(S.area(debris))),vx:nx*90,vy:ny*90-60,kind:body.material==='wax'?0:1,color:body.material==='wax'?[1,.83,.56,1]:[.35,1,.85,.9]});}
    const length=faces.reduce((s,f)=>s+Math.hypot(f.a.x-f.b.x,f.a.y-f.b.y),0)/2;
    const cut={id,faces,children,speed:stroke.speed,length,area:body.area,material:body.material,x:body.x,y:body.y,sourceId:body.id,rootId:body.rootId,depth:body.depth+1,pieces:children.length};
    L.materials[body.material].onCut(body,cut);L.events.emit('cut',{...cut,faces:faces.map(f=>({a:{x:f.a.x,y:f.a.y},b:{x:f.b.x,y:f.b.y}})),children:children.map(b=>b.id)});
    freeze=Math.max(freeze,.03+Math.min(.03,body.area/150000*.03));punch=Math.max(punch,.012+Math.min(.008,body.area/150000*.008));flashes.push({x:body.x,y:body.y,r:body.radius*1.3,life:.16,material:body.material});cutCount++;if(profile)profileLoad.cuts++;lastCut={id,sourceId:body.id,rootId:body.rootId,pieces:children.length,faces,frame:L.frame,speed:stroke.speed};
  }
  function processStroke(stroke){
    const begin=performance.now();let cutAny=false;const paths=new Map();
    if(stroke.points.length<2)return;
    for(const body of bodies.slice()){
      if(body.depth>=config.maxDepth||bodies.length>=config.maxBodies-8)continue;
      if(stroke.speed<(body.material==='wax'?240:100))continue;
      const continued=body.lastStroke===stroke.id,key=continued?body.lastIndex:'whole';
      if(!paths.has(key)){const tail=continued?stroke.points.filter((p,i)=>(p.seq??i)>body.lastIndex):stroke.points;paths.set(key,S.resample(continued?[body.lastPoint,...tail]:tail,2.5));}
      const path=paths.get(key);if(path.length<2||!nearPath(body,path))continue;
      const poly=currentPoly(body);if(!boundsOverlap(poly,path))continue;
      const result=S.splitPath(poly,path,{minArea:config.minPieceArea,cutId:'cut-'+(cutId+1)});
      if(!result.cut||result.pieces.length<1)continue;fracture(body,result,stroke,path);cutAny=true;
    }
    stroke.didCut=stroke.didCut||cutAny;if(profile)profileInput.push(performance.now()-begin);
  }
  function press(stroke){if(stroke.pressed||stroke.didCut)return;const hit=stroke.points[Math.floor(stroke.points.length/2)];for(let i=bodies.length-1;i>=0;i--){const body=bodies[i];if(S.contains(currentPoly(body),hit)){L.materials[body.material].onPress(body,L.localPoint(body,hit));stroke.pressed=true;break;}}}
  function point(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.x)*720/r.width,y=(e.clientY-r.y)*1280/r.height;return {x:(x-360)/(1+punch)+360,y:(y-640)/(1+punch)+640};}
  function down(e){if(e.button!==0&&e.pointerType==='mouse')return;L.audio.unlock();canvas.setPointerCapture(e.pointerId);const p={...point(e),seq:0};strokes.set(e.pointerId,{id:nextStroke++,nextSeq:1,points:[p],started:performance.now(),lastTime:performance.now(),distance:0,speed:0,dirty:false,pressed:false,didCut:false});e.preventDefault();}
  function move(e){const s=strokes.get(e.pointerId);if(!s)return;const events=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const ev of events.length?events:[e]){const p=point(ev),last=s.points[s.points.length-1],d=Math.hypot(p.x-last.x,p.y-last.y);if(d<1)continue;p.seq=s.nextSeq++;s.points.push(p);s.distance+=d;const elapsed=Math.max(.016,(performance.now()-s.lastTime)/1000);s.speed=Math.min(6000,d/elapsed);s.lastTime=performance.now();s.dirty=true;trails.push({a:last,b:p,life:.2,speed:s.speed});if(s.points.length>160)s.points=S.resample(s.points,2);}}
  function up(e,cancelled=false){const s=strokes.get(e.pointerId);if(!s)return;if(!cancelled){move(e);s.ended=true;s.dirty=true;pending.push(s);}strokes.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',e=>up(e));canvas.addEventListener('pointercancel',e=>up(e,true));canvas.addEventListener('lostpointercapture',e=>strokes.delete(e.pointerId));window.addEventListener('blur',()=>strokes.clear());
  document.addEventListener('visibilitychange',()=>{strokes.clear();previous=0;});
  function physics(dt){
    for(const b of bodies){b.age+=dt;if(b.active){b.vy+=config.gravity*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.spin*dt;b.vx*=Math.exp(-.38*dt);const c=Math.cos(b.angle),s=Math.sin(b.angle);let bottom=-Infinity;for(const p of b.poly)bottom=Math.max(bottom,b.y+p.x*s+p.y*c);if(bottom>1115&&b.vy>0){const speed=b.vy;b.y-=bottom-1115;b.vy*=-.22;b.spin*=.6;if(speed>30)L.materials[b.material].onImpact(b,{speed,x:b.x,y:1115});}if(b.x<20&&b.vx<0)b.vx*=-.5;if(b.x>700&&b.vx>0)b.vx*=-.5;}L.materials[b.material].update(dt,b);}
    let n=0;for(const p of particles){p.life-=dt;if(p.life<=0)continue;p.vy+=360*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;particles[n++]=p;}particles.length=n;
  }
  function draw(){
    renderer.begin();
    // Subtle WebGL laboratory guides; no Canvas2D scene drawing.
    renderer.line({x:46,y:1117},{x:674,y:1117},1,[.46,.66,.58,.19]);
    for(const b of bodies){
      const world=worldVertices(b);
      renderer.mesh(b.baseTexture||b.material+'_body',world,b.meshIndices);
      if(L.materials[b.material].draw)L.materials[b.material].draw(renderer,b);
      for(let i=0;i<b.poly.length;i++)if(b.poly[i].cut){const a=world[i],c=world[(i+1)%b.poly.length];renderer.face(a,c,Math.min(L.materials[b.material].crossSection.width,b.radius*.35),b.material,b.soft?b.soft.amplitude/10:0);}
      if(wire){for(let i=0;i<b.meshIndices.length;i+=3)for(let j=0;j<3;j++)renderer.line(world[b.meshIndices[i+j]],world[b.meshIndices[i+(j+1)%3]],.8,[.8,1,.4,.35]);for(let i=0;i<b.poly.length;i++)renderer.line(world[i],world[(i+1)%b.poly.length],b.poly[i].cut?2.5:1,b.poly[i].cut?[1,.4,.3,1]:[.8,1,.7,.7]);}
    }
    for(const t of trails){const a=t.life/.2;renderer.ribbon(t.a,t.b,Math.max(.7,3.3*a),[.85,1,.9,a*.68]);}
    for(const f of flashes)renderer.glow(f.x,f.y,f.r,f.material==='wax'?[1,.76,.35,f.life*.8]:[.2,1,.8,f.life*.8]);
    renderer.render(particles,L.time,punch,slow);
  }
  function frame(ms){
    const elapsed=previous?Math.min(.05,(ms-previous)/1000):1/60;previous=ms;frameIntervals.push(elapsed);if(frameIntervals.length>90)frameIntervals.shift();
    const start=performance.now();L.frame++;
    if(replenish&&L.time>=refillAt){horde(40,false);if(bodies.length>120)bodies.splice(0,bodies.length-120);refillAt=L.time+.45;}
    const advancing=!paused||stepFrames>0;
    if(advancing){
      for(const s of strokes.values()){if(s.dirty){processStroke(s);s.dirty=false;}if(!s.pressed&&s.distance<12&&(performance.now()-s.started)>180)press(s);}
      while(pending.length){const s=pending.shift();processStroke(s);if(s.distance<20||s.speed<240)press(s);}
      const realDt=stepFrames>0?1/60:elapsed,dt=realDt*(slow?.25:1);L.time+=dt;
      // Hit-stop freezes translation, not the material's crack/face response.
      if(freeze>0){freeze=Math.max(0,freeze-realDt);for(const b of bodies)L.materials[b.material].update(dt,b);}else physics(dt);
      punch*=Math.exp(-12*realDt);
      for(const list of [trails,flashes]){let n=0;for(const item of list){item.life-=dt;if(item.life>0)list[n++]=item;}list.length=n;}
      if(stepFrames>0)stepFrames--;
    }
    const drawStart=performance.now();draw();const cost=performance.now()-start;recent.push(cost);if(recent.length>180)recent.shift();
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
  window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;const key=e.key.toLowerCase(),ids={n:'spawn',h:'horde',s:'slow',' ':'pause','.':'step',d:'wire',r:'reset'};if(ids[key]){$(ids[key]).click();e.preventDefault();}if(key==='1'||key==='2'){$('material').value=key==='1'?'wax':'jelly';$('material').onchange();}});
  L.test={
    clear,spawn,horde,hordeLine,
    getState(){return {webgl2:renderer.gl instanceof WebGL2RenderingContext,frame:L.frame,time:L.time,paused,slow,freeze,punch,cutCount,lastCut,particles:particles.length,assets:L.assetStatus,bodies:bodies.map(b=>({id:b.id,rootId:b.rootId,material:b.material,depth:b.depth,x:b.x,y:b.y,area:b.area,poly:currentPoly(b),soft:b.soft?{age:b.soft.age,amplitude:b.soft.amplitude,points:b.soft.points.map(p=>({x:p.x,y:p.y,rx:p.rx,ry:p.ry,face:p.face}))}:null,crack:b.wax?{age:b.wax.age,shown:b.wax.shown,edges:b.wax.edges.length,peeled:b.wax.cells.filter(c=>c.peeled).length}:null})),events:L.events.history.slice()};},
    profile(on){if(on){profileSamples=[];profileInput=[];profileStages=[];profileLoad={minBodies:Infinity,maxBodies:0,maxParticles:0,cuts:0};}profile=on;return {samples:profileSamples,inputSamples:profileInput,stages:profileStages,load:profileLoad};},
    replenish(on){replenish=on;refillAt=L.time+.45;},
    setPaused(on){paused=on;setButton('pause',on);},
    // Same queued input processing as Pointer Events; used only for geometry stress.
    path(points,speed=2000){pending.push({id:nextStroke++,points,speed,distance:1000,ended:true});}
  };
  L.ready=true;spawn();requestAnimationFrame(frame);
})(window.LAB);
