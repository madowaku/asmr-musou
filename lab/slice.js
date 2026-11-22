/* Pure geometry: browser classic script and Node CommonJS. No DOM dependencies.
 * Simple polygons, CCW in numeric coordinates; p.cut describes p -> next.
 * A planar half-edge arrangement preserves disconnected concave fragments and UVs.
 */
(function (root) {
  'use strict';
  const EPS = 1e-7;
  const cross = (a, b, c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const dist2 = (a,b) => (a.x-b.x)**2+(a.y-b.y)**2;
  function signedArea(p) { let a=0; for(let i=0,j=p.length-1;i<p.length;j=i++) a+=p[j].x*p[i].y-p[i].x*p[j].y; return a/2; }
  const area = p => Math.abs(signedArea(p));
  function centroid(p) {
    let x=0,y=0,a=0;
    for(let i=0;i<p.length;i++){ const q=p[(i+1)%p.length],k=p[i].x*q.y-q.x*p[i].y; a+=k;x+=(p[i].x+q.x)*k;y+=(p[i].y+q.y)*k; }
    return Math.abs(a)>EPS?{x:x/(3*a),y:y/(3*a)}:{x:p.reduce((s,v)=>s+v.x,0)/p.length,y:p.reduce((s,v)=>s+v.y,0)/p.length};
  }
  function clean(poly) {
    const p=[];
    for(const v of poly) if(!p.length||dist2(v,p[p.length-1])>EPS*EPS) p.push({...v});
    if(p.length>1&&dist2(p[0],p[p.length-1])<EPS*EPS) p.pop();
    if(signedArea(p)<0){ const old=p.map(v=>v.cut);p.reverse();p.forEach((v,i)=>v.cut=old[(old.length-2-i+old.length)%old.length]); }
    return p;
  }
  function onSegment(p,a,b,eps=EPS) { return Math.abs(cross(a,b,p))<=eps*Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))&&p.x>=Math.min(a.x,b.x)-eps&&p.x<=Math.max(a.x,b.x)+eps&&p.y>=Math.min(a.y,b.y)-eps&&p.y<=Math.max(a.y,b.y)+eps; }
  function contains(poly,p,boundary=true) {
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[j],b=poly[i];if(onSegment(p,a,b))return boundary;
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }return inside;
  }
  function inTriangle(p,a,b,c) { return cross(a,b,p)>=-EPS&&cross(b,c,p)>=-EPS&&cross(c,a,p)>=-EPS; }
  function triangulate(poly) {
    if(poly.length<3)return [];
    const ids=Array.from({length:poly.length},(_,i)=>i),out=[];
    if(signedArea(poly)<0)ids.reverse();
    let guard=poly.length*poly.length;
    while(ids.length>3&&guard-->0){
      let found=false;
      for(let k=0;k<ids.length;k++){
        const a=ids[(k+ids.length-1)%ids.length],b=ids[k],c=ids[(k+1)%ids.length];
        if(cross(poly[a],poly[b],poly[c])<=EPS)continue;
        if(ids.some(i=>i!==a&&i!==b&&i!==c&&inTriangle(poly[i],poly[a],poly[b],poly[c])))continue;
        out.push(a,b,c);ids.splice(k,1);found=true;break;
      }
      if(!found){
        const k=ids.findIndex((v,i)=>Math.abs(cross(poly[ids[(i+ids.length-1)%ids.length]],poly[v],poly[ids[(i+1)%ids.length]]))<=EPS);
        if(k<0)throw new Error('Non-simple or degenerate polygon cannot be triangulated');
        ids.splice(k,1);
      }
    }
    if(ids.length===3&&Math.abs(cross(poly[ids[0]],poly[ids[1]],poly[ids[2]]))>EPS)out.push(...ids);
    return out;
  }
  function interpolate(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,u:(a.u||0)+((b.u||0)-(a.u||0))*t,v:(a.v||0)+((b.v||0)-(a.v||0))*t};}
  function uvAt(poly,tri,p){
    for(let k=0;k<tri.length;k+=3){
      const a=poly[tri[k]],b=poly[tri[k+1]],c=poly[tri[k+2]],den=cross(a,b,c);
      const wa=cross(p,b,c)/den,wb=cross(a,p,c)/den,wc=1-wa-wb;
      if(wa>=-EPS&&wb>=-EPS&&wc>=-EPS)return {u:wa*(a.u||0)+wb*(b.u||0)+wc*(c.u||0),v:wa*(a.v||0)+wb*(b.v||0)+wc*(c.v||0)};
    } return {u:0,v:0};
  }
  function intersectionParams(a,b,c,d){
    const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
    if(Math.abs(den)>EPS){ const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?[[Math.max(0,Math.min(1,t)),Math.max(0,Math.min(1,u))]]:[]; }
    if(!onSegment(c,a,b)&&!onSegment(d,a,b)&&!onSegment(a,c,d)&&!onSegment(b,c,d))return [];
    const rr=rx*rx+ry*ry,ss=sx*sx+sy*sy;if(rr<EPS||ss<EPS)return [];
    const out=[];
    for(const p of [a,b,c,d])if(onSegment(p,a,b)&&onSegment(p,c,d))out.push([((p.x-a.x)*rx+(p.y-a.y)*ry)/rr,((p.x-c.x)*sx+(p.y-c.y)*sy)/ss]);
    return out;
  }
  function splitPath(polygon,path,options={}) {
    const poly=clean(polygon),sourceArea=area(poly),unchanged=()=>({pieces:[poly],debris:[],sourceArea,cut:false});
    if(poly.length<3||path.length<2)return unchanged();
    // Common case: exactly two proper crossings. Clip once per side without
    // constructing a graph. More crossings, corners and collinearity use the
    // arrangement below; never stitch disconnected C-shape islands together.
    if(path.length===2){
      const a=path[0],b=path[1],sides=poly.map(p=>cross(a,b,p));
      if(sides.every(s=>s>EPS)||sides.every(s=>s<-EPS))return unchanged();
      if(sides.every(s=>Math.abs(s)>EPS)){
        const crossings=[];
        for(let i=0;i<poly.length;i++)if((sides[i]>0)!==(sides[(i+1)%poly.length]>0))crossings.push(interpolate(poly[i],poly[(i+1)%poly.length],sides[i]/(sides[i]-sides[(i+1)%poly.length])));
        if(crossings.length===2){
          const den=dist2(a,b),parameters=crossings.map(p=>((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/den);
          if(parameters.some(t=>t<-EPS||t>1+EPS))return unchanged();
          const faces=[1,-1].map(side=>{const out=[];for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length,inside=sides[i]*side>0,next=sides[j]*side>0;if(inside)out.push({...poly[i]});if(inside!==next)out.push({...interpolate(poly[i],poly[j],sides[i]/(sides[i]-sides[j])),cut:inside?(options.cutId||'cut'):poly[i].cut});}return out;});
          const minArea=options.minArea===undefined?.25:options.minArea;
          return {pieces:faces.filter(p=>area(p)>=minArea),debris:faces.filter(p=>area(p)<minArea),sourceArea,cut:true};
        }
      }
    }
    const segments=poly.map((a,i)=>({a,b:poly[(i+1)%poly.length],boundary:true,mark:a.cut||null,ts:[0,1]}));
    for(let i=1;i<path.length;i++)if(dist2(path[i-1],path[i])>EPS)segments.push({a:path[i-1],b:path[i],boundary:false,mark:options.cutId||'cut',ts:[0,1]});
    for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
      if(segments[i].boundary&&segments[j].boundary)continue;
      const a=segments[i],b=segments[j];for(const [t,u]of intersectionParams(a.a,a.b,b.a,b.b)){a.ts.push(t);b.ts.push(u);}
    }
    const nodes=[],map=new Map(),edges=new Map(),tri=triangulate(poly);
    function node(p){const key=Math.round(p.x*1e6)+','+Math.round(p.y*1e6);if(map.has(key))return map.get(key);const n=nodes.length;nodes.push({...p,...uvAt(poly,tri,p),links:[]});map.set(key,n);return n;}
    for(const s of segments){
      const ts=[...new Set(s.ts.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b);
      for(let i=1;i<ts.length;i++){
        if(ts[i]-ts[i-1]<EPS)continue;
        const a=interpolate(s.a,s.b,ts[i-1]),b=interpolate(s.a,s.b,ts[i]);
        if(!s.boundary&&!contains(poly,interpolate(a,b,.5),false))continue;
        const u=node(a),v=node(b);if(u===v)continue;const key=u<v?u+','+v:v+','+u;
        if(!edges.has(key)||s.boundary)edges.set(key,{u,v,mark:s.mark,boundary:s.boundary,alive:true});
      }
    }
    for(const e of edges.values()){nodes[e.u].links.push(e);nodes[e.v].links.push(e);}
    // A knife ending inside has not severed anything. Remove dangling branches.
    const queue=nodes.map((n,i)=>i).filter(i=>nodes[i].links.length<2);
    for(let q=0;q<queue.length;q++){ const n=queue[q];for(const e of nodes[n].links)if(e.alive&&!e.boundary){e.alive=false;const v=e.u===n?e.v:e.u;if(nodes[v].links.filter(x=>x.alive).length<2)queue.push(v);} }
    const adj=nodes.map((n,i)=>n.links.filter(e=>e.alive).map(e=>({to:e.u===i?e.v:e.u,mark:e.mark})).sort((a,b)=>Math.atan2(nodes[a.to].y-n.y,nodes[a.to].x-n.x)-Math.atan2(nodes[b.to].y-n.y,nodes[b.to].x-n.x)));
    const used=new Set(),faces=[];
    for(let u=0;u<nodes.length;u++)for(const first of adj[u]){
      if(used.has(u+','+first.to))continue;
      let a=u,b=first.to,mark=first.mark;const face=[];let guard=edges.size*2+2;
      do{
        used.add(a+','+b);const n=nodes[a];face.push({x:n.x,y:n.y,u:n.u,v:n.v,cut:mark});
        const links=adj[b],back=links.findIndex(v=>v.to===a),next=links[(back-1+links.length)%links.length];
        a=b;b=next.to;mark=next.mark;
      }while((a!==u||b!==first.to)&&guard-->0);
      if(guard>0&&signedArea(face)>EPS)faces.push(face);
    }
    if(faces.length<2)return unchanged();
    // Closed interior loops would require polygons with holes: leave them intact.
    if(Math.abs(faces.reduce((s,p)=>s+area(p),0)-sourceArea)>Math.max(.0001,sourceArea*.00001))return unchanged();
    const minArea=options.minArea===undefined?.25:options.minArea;
    return {pieces:faces.filter(p=>area(p)>=minArea),debris:faces.filter(p=>area(p)<minArea),sourceArea,cut:true};
  }
  function splitLine(poly,a,b,options={}){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<EPS)return {pieces:[clean(poly)],debris:[],sourceArea:area(poly),cut:false};
    let extent=1;for(const p of poly)extent=Math.max(extent,Math.hypot(p.x-a.x,p.y-a.y));extent*=3;
    return splitPath(poly,[{x:a.x-dx/len*extent,y:a.y-dy/len*extent},{x:a.x+dx/len*extent,y:a.y+dy/len*extent}],options);
  }
  function splitBody(body,path,options={}){
    if((body.depth||0)>=(options.maxDepth===undefined?3:options.maxDepth))return {pieces:[body],debris:[],cut:false,sourceArea:area(body.poly)};
    const result=splitPath(body.poly,path,options);
    return {...result,pieces:result.cut?result.pieces.map(poly=>({...body,poly,depth:(body.depth||0)+1})):[body]};
  }
  // Ramer-Douglas-Peucker resampling retains corners; straight fast strokes stay long.
  function resample(path,tolerance=3){
    if(path.length<3)return path.map(p=>({...p}));
    const a=path[0],b=path[path.length-1],den=dist2(a,b);let best=tolerance*tolerance,index=-1;
    for(let i=1;i<path.length-1;i++){const p=path[i],t=den?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/den)):0,d=dist2(p,interpolate(a,b,t));if(d>best){best=d;index=i;}}
    return index<0?[{...a},{...b}]:resample(path.slice(0,index+1),tolerance).slice(0,-1).concat(resample(path.slice(index),tolerance));
  }
  const api={EPS,cross,dist2,area,signedArea,centroid,contains,clean,triangulate,interpolate,uvAt,splitLine,splitPath,splitBody,resample};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  (root.LAB=root.LAB||{}).slice=api;
})(typeof window!=='undefined'?window:globalThis);
