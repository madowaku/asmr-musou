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
    onCut(body,cut){for(const child of cut.children)impulse(child,Math.min(520,260+cut.speed*.08));for(const face of cut.faces)for(let i=0;i<4;i++){const t=L.random();L.addParticle({x:face.a.x+(face.b.x-face.a.x)*t,y:face.a.y+(face.b.y-face.a.y)*t,kind:1,size:2+L.random()*4,vx:(L.random()-.5)*100,vy:-50-L.random()*90,color:[.3,1,.86,.85]});}},
    onPress(body,hit){for(const p of body.soft.points){const weight=Math.exp(-S.dist2(p,hit)/(body.radius*body.radius*.5));p.vy+=90*weight;}body.soft.age=0;body.soft.sleeping=false;},
    onImpact(body,impact){for(const p of body.soft.points)p.vy-=Math.min(130,impact.speed*.3)*(p.ry>0?1:.25);body.soft.age=0;body.soft.sleeping=false;},
    update(dt,body){
      const soft=body.soft,points=soft.points;if(!dt||soft.sleeping)return;
      const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
      for(let sub=0;sub<steps;sub++){
        let cx=0,cy=0;for(const p of points){p.ox=p.x;p.oy=p.y;cx+=p.x;cy+=p.y;}cx/=points.length;cy/=points.length;
        let dot=0,cross=0;for(const p of points){dot+=p.qx*(p.x-cx)+p.qy*(p.y-cy);cross+=p.qx*(p.y-cy)-p.qy*(p.x-cx);}
        const theta=Math.atan2(cross,dot),c=Math.cos(theta),s=Math.sin(theta),damping=Math.exp(-6*h);
        for(const p of points){
          // Translation/rotation are owned by body physics; soft mode is elastic.
          const gx=(soft.cx+c*p.qx-s*p.qy)*.92+p.rx*.08,gy=(soft.cy+s*p.qx+c*p.qy)*.92+p.ry*.08;
          // Force-form goal matching avoids the excess numerical damping of
          // position projection followed by velocity reconstruction.
          const stiffness=p.face?1200:2600;
          p.vx=(p.vx+(gx-p.ox)*stiffness*h)*damping;p.vy=(p.vy+(gy-p.oy)*stiffness*h)*damping;
          p.x=p.ox+p.vx*h;p.y=p.oy+p.vy*h;
        }
      }
      let sum=0,count=0;for(const p of points)if(p.face){sum+=(p.x-p.rx)**2+(p.y-p.ry)**2;count++;}soft.amplitude=count?Math.sqrt(sum/count):0;soft.age+=dt;soft.eventClock+=dt;
      if(points.every(p=>p.vx*p.vx+p.vy*p.vy<.0004&&(p.x-p.rx)**2+(p.y-p.ry)**2<.0001)){soft.sleeping=true;for(const p of points){p.x=p.rx;p.y=p.ry;p.vx=p.vy=0;}soft.amplitude=0;}
      if(soft.eventClock>=.05&&soft.amplitude>.1){soft.eventClock=0;L.events.emit('wobble',{material:'jelly',bodyId:body.id,speed:0,length:0,area:body.area,x:body.x,y:body.y,frequency:soft.frequency,amplitude:soft.amplitude});}
    }
  });
})(window.LAB);
