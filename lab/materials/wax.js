(function(L){
  'use strict';
  const S=L.slice;
  function clip(poly,a,b){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],sp=S.cross(a,b,p),sq=S.cross(a,b,q);if(sp>=-1e-7)out.push({...p});if((sp>0)!==(sq>0))out.push(S.interpolate(p,q,sp/(sp-sq)));}return out;}
  function network(body,hit,duration=.08){
    const p=body.poly,r=body.radius,seeds=[];
    // Jittered sites; deterministic through LAB.random. Only made on first press.
    for(let y=-.75;y<=.8;y+=.37)for(let x=-.75;x<=.8;x+=.37){const s={x:(x+(L.random()-.5)*.25)*r,y:(y+(L.random()-.5)*.25)*r};if(S.contains(p,s))seeds.push(s);}
    const cells=[];
    for(const site of seeds){let cell=p.map(v=>({...v}));for(const other of seeds){if(other===site)continue;const mid={x:(site.x+other.x)/2,y:(site.y+other.y)/2},dx=other.x-site.x,dy=other.y-site.y;cell=clip(cell,mid,{x:mid.x-dy,y:mid.y+dx});if(!cell.length)break;}if(cell.length>2)cells.push({poly:cell,center:S.centroid(cell),peeled:false});}
    const nodes=[],lookup=new Map(),edges=[],keys=new Set();
    function node(v){const k=Math.round(v.x*1000)+','+Math.round(v.y*1000);if(!lookup.has(k)){lookup.set(k,nodes.length);nodes.push({x:v.x,y:v.y,d:Infinity});}return lookup.get(k);}
    for(const cell of cells)for(let i=0;i<cell.poly.length;i++){const a=node(cell.poly[i]),b=node(cell.poly[(i+1)%cell.poly.length]),k=Math.min(a,b)+','+Math.max(a,b);if(!keys.has(k)){keys.add(k);edges.push({a,b,length:Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y)});}}
    if(!nodes.length)return null;
    let nearest=0;nodes.forEach((v,i)=>{if(S.dist2(v,hit)<S.dist2(nodes[nearest],hit))nearest=i;});nodes[nearest].d=0;
    const done=new Set();for(let k=0;k<nodes.length;k++){let best=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(best<0||nodes[i].d<nodes[best].d))best=i;if(best<0)break;done.add(best);for(const e of edges){const next=e.a===best?e.b:e.b===best?e.a:-1;if(next>=0)nodes[next].d=Math.min(nodes[next].d,nodes[best].d+e.length);}}
    const max=Math.max(...nodes.map(n=>n.d),1),growthDuration=duration;
    for(const e of edges){if(nodes[e.a].d>nodes[e.b].d)[e.a,e.b]=[e.b,e.a];e.start=nodes[e.a].d/max*growthDuration;e.duration=Math.max(.012,e.length/max*growthDuration);}
    for(const cell of cells)cell.peelAt=duration+.025+Math.hypot(cell.center.x-hit.x,cell.center.y-hit.y)/(2*r)*.21+L.random()*.035;
    return {nodes,edges,cells,age:0,shown:0,growthDuration};
  }
  L.registerMaterial({
    id:'wax',name:'ロウ',hardness:.78,layers:{shell:{thickness:3,color:'#e4a260'},core:{color:'#fff0be',softness:.8}},
    crossSection:{width:16,shellBand:.18,gloss:.45,translucency:0,rim:'#ffe9b2'},
    init(body,parent){body.wax=null;},
    onPress(body,hit){if(body.depth||body.wax)return;body.wax=network(body,hit,L.timing.duration('wax','pre'));L.events.emit('press',{material:'wax',x:body.x+hit.x,y:body.y+hit.y,speed:0,length:0,area:body.area});},
    onCut(body,cut){
      for(const child of cut.children)if(child.lod!=='strip'){
        const face=child.poly.find(p=>p.cut===cut.id)||child.poly[0];child.wax=network(child,face,.08);
        if(child.wax)for(const cell of child.wax.cells)cell.peelAt=.065+L.random()*.09;
      }
      for(const face of cut.faces){const len=Math.hypot(face.b.x-face.a.x,face.b.y-face.a.y),n=Math.min(14,Math.max(2,Math.round(len/18)));for(let i=0;i<n;i++){const t=(i+.5)/n;L.addParticle({x:face.a.x+(face.b.x-face.a.x)*t,y:face.a.y+(face.b.y-face.a.y)*t,kind:Math.floor(L.random()*3),size:6+L.random()*8,color:[1,1,1,1],vx:(L.random()-.5)*180,vy:-45-L.random()*120});}}
    },
    onImpact(body,impact){if(impact.speed>160&&!body.depth)this.onPress(body,{x:0,y:body.radius*.8});},
    update(dt,body){
      const wax=body.wax;if(!wax)return;wax.age+=dt;let shown=0;
      for(const e of wax.edges)shown+=e.length*Math.max(0,Math.min(1,(wax.age-e.start)/e.duration));
      const growth=shown-wax.shown;if(growth>0)L.events.emit('crack_grow',{material:'wax',bodyId:body.id,speed:0,length:growth,area:body.area,x:body.x,y:body.y,growthRate:growth/Math.max(dt,.001)});wax.shown=shown;
      for(const cell of wax.cells)if(!body.pressing&&!cell.peeled&&wax.age>=cell.peelAt){cell.peeled=true;const p=L.worldPoint(body,cell.center);for(let j=0;j<3;j++)L.addParticle({x:p.x,y:p.y,kind:Math.floor(L.random()*3),size:8+L.random()*10,vx:(L.random()-.5)*130,vy:-70-L.random()*100,color:[1,1,1,1]});L.events.emit('peel',{material:'wax',bodyId:body.id,x:p.x,y:p.y,speed:100,length:0,area:S.area(cell.poly)});}

    },
    draw(renderer,body){
      const wax=body.wax;if(!wax)return;

      for(const e of wax.edges){const t=Math.max(0,Math.min(1,(wax.age-e.start)/e.duration));if(!t)continue;const a=L.worldPoint(body,wax.nodes[e.a]),b=L.worldPoint(body,S.interpolate(wax.nodes[e.a],wax.nodes[e.b],t));renderer.line(a,b,1.6,[1,.93,.72,Math.max(0,1-(wax.age-(body.pressing?.duration||.2))*5)]);}
    }
  });
})(window.LAB);
