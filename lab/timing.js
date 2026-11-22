/* Seconds for phases; milliseconds for wave offsets. Fallback follows the canon
 * and R2b's profile shape; read LAB.profiles at call time, never overwrite it. */
(function(L){
  'use strict';
  const phase=(min,max,kind)=>({min,max,kind});
  const rows={wax:[.3,.8,.4,.6],bubble:[0,.02,null,null],jelly:[.03,.06,.6,1],soap:[0,.04,.3,.6],sand:[.05,.1,1.5,3],chalk:[.02,.04,.8,1.2],sponge:[null,null,.5,1],beadslime:[null,null,.6,1],kohaku:[.02,.05,.4,.7]};
  const fallback=Object.fromEntries(Object.entries(rows).map(([m,v])=>[m,{pre:phase(v[0],v[1],'fallback'),release:{kind:'fracture'},post:phase(v[2],v[3],'fallback')}]));
  L.timing={
    profile:m=>(L.profiles||fallback)[m]||fallback.wax,
    duration(m,phaseName){const p=this.profile(m)[phaseName];return p.min==null?null:(p.min+p.max)/2;},
    plan(kills,swipe){
      if(L.audio?.planWave)return L.audio.planWave(kills,swipe);
      const n=kills.length,dx=swipe.to.x-swipe.from.x,dy=swipe.to.y-swipe.from.y;
      const tier=n<=1?[1,1,0,0]:n<=4?[2,4,40,80]:n<=12?[5,12,120,220]:n<=25?[13,25,220,350]:[26,40,300,450];
      const length=tier[2]+(tier[3]-tier[2])*Math.min(1,(n-tier[0])/Math.max(1,tier[1]-tier[0]));
      const sorted=kills.map(k=>({...k,along:k.x*dx+k.y*dy})).sort((a,b)=>a.along-b.along),extent=n?sorted[n-1].along-sorted[0].along:0;
      return sorted.map((k,i)=>({...k,dt:n===1?0:length*(extent?(k.along-sorted[0].along)/extent:i/(n-1))}));
    }
  };
})(window.LAB);
