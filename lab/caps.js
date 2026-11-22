/* Book-open: skin foreshortening + a projected copy of the actual piece outline.
 * Horde LOD: broad extruded edge, same texture and lighting, fewer vertices. */
(function(L){
  const S=L.slice,clamp=v=>Math.max(0,Math.min(1,v));
  L.cap={
    init(b,path,lod){
      const a=L.localPoint(b,path[0]),z=L.localPoint(b,path.at(-1)),len=Math.hypot(z.x-a.x,z.y-a.y)||1;
      const nx=-(z.y-a.y)/len,ny=(z.x-a.x)/len,side=Math.sign(-a.x*nx-a.y*ny)||1;
      b.cap={a,nx,ny,side,lod,age:0,reach:Math.max(...b.poly.map(p=>Math.abs((p.x-a.x)*nx+(p.y-a.y)*ny))),indices:S.triangulate(b.poly)};
    },
    theta(b){const c=b.cap;if(c.thetaFrame===L.frame&&c.thetaAge===c.age)return c.thetaValue;c.thetaFrame=L.frame;c.thetaAge=c.age;return c.thetaValue=this.thetaAt(c.age);},
    thetaAt(age){return .611*(1-(1-clamp(age/.12))**3)*(age<.18?1:.78+.22*Math.exp(-(age-.18)*3));},
    skin(b,p){
      if(!b.cap||b.cap.lod==='strip')return p;
      const c=b.cap,d=(p.x-c.a.x)*c.nx+(p.y-c.a.y)*c.ny,k=Math.cos(this.theta(b))-1;
      return {...p,x:p.x+c.nx*d*k,y:p.y+c.ny*d*k};
    },
    draw(r,b){
      if(!b.cap)return;
      const c=b.cap,sin=Math.sin(this.theta(b)),jelly=b.material==='jelly';
      if(c.lod==='strip'){
        for(let i=0;i<b.poly.length;i++)if(b.poly[i].cut){const a=L.worldPoint(b,b.poly[i]),z=L.worldPoint(b,b.poly[(i+1)%b.poly.length]);r.face(a,z,Math.min(b.radius*.55,32),b.material,0);}
        return;
      }
      const pts=b.poly.map(p=>{
        const d=(p.x-c.a.x)*c.nx+(p.y-c.a.y)*c.ny,along=(p.x-c.a.x)*c.ny-(p.y-c.a.y)*c.nx;
        // A travelling wave, not a global translation: visible at 33ms cadence.
        const wave=jelly?Math.sin(along/26-c.age*23)*Math.sin(Math.PI*clamp(Math.abs(d)/c.reach+.1))*Math.min(14,b.radius*.10)*Math.exp(-c.age/0.65):0;
        const local={x:p.x+c.nx*(d*(sin-1)+wave),y:p.y+c.ny*(d*(sin-1)+wave)};
        return {...L.worldPoint(b,local),shade:Math.abs(d)/Math.max(1,c.reach)};
      });
      if(sin<.02)return;
      b.capVertices=pts;
      // Mob grunts (~50px on screen): one cap layer and only the cut-edge line. The full outline stroke and
      // the shell/core double cap are invisible at that size but were ~2/3 of horde draw cost.
      if(b.radius<45){r.cap('xsec/'+b.material,pts,c.indices,jelly?3:2,[1,1,1,1]);for(let i=0;i<b.poly.length;i++)if(b.poly[i].cut)r.line(pts[i],pts[(i+1)%pts.length],jelly?2.6:2,jelly?[1,.96,1,.9]:[1,.72,.84,1]);return;}
      const center=S.centroid(pts);
      if(b.material==='wax'){
        r.cap('xsec/wax_shell',pts,c.indices,2,[1,.86,.96,1]);
        const inner=pts.map(p=>({...p,x:center.x+(p.x-center.x)*.945,y:center.y+(p.y-center.y)*.91}));
        r.cap('xsec/wax',inner,c.indices,2,[1,1,1,1]);
      }else r.cap('xsec/'+b.material,pts,c.indices,jelly?3:2,[1,1,1,1]);
      for(let i=0;i<pts.length;i++)r.line(pts[i],pts[(i+1)%pts.length],jelly?2.2:1.35,jelly?[.94,.88,1,.72]:[1,.88,.93,.92]);
      // Bright wet edge follows the newly exposed curved face.
      if(jelly)for(let i=0;i<b.poly.length;i++)if(b.poly[i].cut)r.line(pts[i],pts[(i+1)%pts.length],3,[1,.96,1,.9]);
    }
  };
})(window.LAB);
