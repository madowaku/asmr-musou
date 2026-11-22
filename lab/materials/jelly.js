/* 2D rigid shape matching: integrate -> best-fit polar rotation -> goal projection.
 * Interior particles are actual mesh vertices. Cut boundary points receive velocity
 * impulses and weaker goal projection; no shader-only wobble or scale animation. */
(function(L){
  'use strict';
  const S=L.slice;
  function build(body,parent){
    // Subdivide cut edges so the newly exposed face can bend between its endpoints.
    const outline=[];
    for(let i=0;i<body.poly.length;i++){const a=body.poly[i],b=body.poly[(i+1)%body.poly.length],n=a.cut?Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/22)):1;for(let j=0;j<n;j++)outline.push({...S.interpolate(a,b,j/n),cut:a.cut});}
    body.poly=outline;const indices=S.triangulate(outline),points=outline.map((p,i)=>({...p,rx:p.x,ry:p.y,vx:0,vy:0,face:!!p.cut||!!outline[(i+outline.length-1)%outline.length].cut}));
    const candidates=[];
    if(parent&&parent.soft){for(const p of parent.soft.points.slice(parent.poly.length)){const world=L.worldPoint(parent,p),local=L.localPoint(body,world);if(S.contains(outline,local,false))candidates.push({...local,u:p.u,v:p.v,vx:p.vx,vy:p.vy});}}
    if(!candidates.length){const step=body.radius>70?body.radius*.43:body.radius*.8;for(let y=-body.radius*.7;y<body.radius*.8;y+=step)for(let x=-body.radius*.7;x<body.radius*.8;x+=step)if(S.contains(outline,{x,y},false))candidates.push({x,y,...S.uvAt(outline,indices,{x,y})});}
    for(const p of candidates){
      if(points.some(q=>S.dist2(p,q)<16))continue;
      for(let k=0;k<indices.length;k+=3){const a=indices[k],b=indices[k+1],c=indices[k+2];if(S.cross(points[a],points[b],p)>1e-4&&S.cross(points[b],points[c],p)>1e-4&&S.cross(points[c],points[a],p)>1e-4){const n=points.length;points.push({...p,rx:p.x,ry:p.y,vx:p.vx||0,vy:p.vy||0,face:false});indices.splice(k,3,a,b,n,b,c,n,c,a,n);break;}}
    }
    let cx=0,cy=0;for(const p of points){cx+=p.rx;cy+=p.ry;}cx/=points.length;cy/=points.length;
    for(const p of points){p.qx=p.rx-cx;p.qy=p.ry-cy;}
    body.soft={points,indices,cx,cy,age:0,amplitude:0,frequency:5.8,eventClock:0,sleeping:true};body.meshIndices=indices;
  }
  function impulse(body,strength){
    const soft=body.soft;
    strength=Math.min(strength,body.radius*3.2);
    const facePoints=soft.points.filter(p=>p.face);
    const center=facePoints.length?facePoints.reduce((s,p)=>({x:s.x+p.rx/facePoints.length,y:s.y+p.ry/facePoints.length}),{x:0,y:0}):{x:0,y:0};
    const reach=Math.max(1,...facePoints.map(p=>Math.hypot(p.rx-center.x,p.ry-center.y)));
    for(let i=0;i<body.poly.length;i++){
      const a=body.poly[i],b=body.poly[(i+1)%body.poly.length];if(!a.cut)continue;
      const len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
      for(const j of [i,(i+1)%body.poly.length]){const p=soft.points[j],weight=.4+.8*Math.cos(Math.min(1,Math.hypot(p.rx-center.x,p.ry-center.y)/reach)*Math.PI/2);p.vx+=nx*strength*.5*weight;p.vy+=ny*strength*.5*weight;}
    }
    soft.age=0;soft.sleeping=false;
  }
  L.registerMaterial({
    id:'jelly',name:'ゼリー',hardness:.16,layers:{shell:null,core:{translucency:.7}},
    crossSection:{width:14,gloss:.95,translucency:.7,rim:'#d4fff2'},
    init:build,
    onCut(body,cut){for(const child of cut.children)impulse(child,Math.min(520,260+cut.speed*.08));for(const face of cut.faces)for(let i=0;i<4;i++){const t=L.random();L.addParticle({x:face.a.x+(face.b.x-face.a.x)*t,y:face.a.y+(face.b.y-face.a.y)*t,kind:L.fxSlots.sponge_drop,size:4+L.random()*6,vx:(L.random()-.5)*100,vy:-50-L.random()*90,color:[.8,.64,1,.85]});}},
    onPress(body,hit){for(const p of body.soft.points){const weight=Math.exp(-S.dist2(p,hit)/(body.radius*body.radius*.5));p.vy+=90*weight;}body.soft.age=0;body.soft.sleeping=false;},
    onImpact(body,impact){for(const p of body.soft.points)p.vy-=Math.min(130,impact.speed*.3)*(p.ry>0?1:.25);/* Landing re-excites only part of the envelope so repeated bounces settle instead of restarting at full amplitude. */const soft=body.soft,back=Math.min(.35,impact.speed/1400);soft.age=soft.sleeping?Math.max(soft.age,.45):Math.max(0,soft.age-back);soft.sleeping=false;},
    update(dt,body){
      const soft=body.soft;if(!dt||soft.sleeping)return;soft.age+=dt;soft.eventClock+=dt;
      const t=soft.age,post=L.timing.duration('jelly','post'),envelope=Math.exp(-t/(post*.62)),stretch=Math.sin(t*2*Math.PI*3.4)*.17*envelope;
      let sum=0,count=0;
      for(const p of soft.points){
        const wave=p.face?Math.sin(p.rx/27-t*25)*Math.min(18,body.radius*.14)*envelope:0;
        p.x=p.rx*(1+stretch);p.y=p.ry/(1+stretch)+wave;
        if(p.face){sum+=(p.x-p.rx)**2+(p.y-p.ry)**2;count++;}
      }
      soft.amplitude=count?Math.sqrt(sum/count):0;soft.frequency=3.4;
      if(t>2.6){soft.sleeping=true;for(const p of soft.points){p.x=p.rx;p.y=p.ry;}soft.amplitude=0;}
      if(soft.eventClock>=.04&&soft.amplitude>.1){soft.eventClock=0;L.events.emit('wobble',{material:'jelly',bodyId:body.id,x:body.x,y:body.y,area:body.area,frequency:soft.frequency,freq:soft.frequency,amplitude:soft.amplitude,amp:Math.min(1,soft.amplitude/18)});}
    }
  });
})(window.LAB);
