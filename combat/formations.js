/* Enemy formations as small problems (no forced solution) + the multi-layer giant material boss. */
(function(L){
  'use strict';
  const C=L.combat=L.combat||{};
  // Material properties for combat. hard = needs a charged slash / costs a projectile more energy.
  C.MAT={
    soap:{hard:.8,wet:true}, jelly:{hard:.5,wet:true}, beadslime:{hard:.5,wet:true}, sponge:{hard:.6,wet:true},
    wax:{hard:1.3,wet:false}, sand:{hard:1,wet:false}, kohaku:{hard:1.6,wet:false}, chalk:{hard:3,wet:false,armor:true}
  };
  const R=()=>L.random(),pick=a=>a[Math.floor(R()*a.length)];
  function hex(cx,cy,cols,rows,gap,mats,rmin=24,rmax=32){const out=[];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=cx+(i-(cols-1)/2)*gap+(j&1?gap/2:0)+(R()-.5)*8,y=cy+(j-(rows-1)/2)*gap*.86+(R()-.5)*8;if(x<36||x>684)continue;out.push({m:typeof mats==='function'?mats(i,j):pick(mats),x,y,r:rmin+R()*(rmax-rmin)});}return out;}
  C.FORMATIONS=[
    {id:'dense',name:'密集',hint:'一筆で、まとめて。',par:2,build:()=>hex(360,430,7,4,62,['soap','jelly','soap','jelly','wax','kohaku'])},
    {id:'column',name:'縦列',hint:'先頭を打てば、後ろまで届く。',par:2,build:()=>{const out=[];for(const x of [250,470])for(let i=0;i<8;i++)out.push({m:i===0?'chalk':pick(['wax','kohaku','soap','jelly']),x:x+(R()-.5)*10,y:740-i*62,r:25+R()*6});return out;}},
    {id:'ring',name:'包囲',hint:'囲まれたら、回って。',par:2,around:true,build:h=>{const out=[],n=14,cx=Math.max(240,Math.min(480,h.x)),cy=Math.max(520,Math.min(960,h.y));for(let i=0;i<n;i++){const a=i/n*Math.PI*2;out.push({m:pick(['sand','beadslime','jelly','soap']),x:cx+Math.cos(a)*200,y:cy+Math.sin(a)*200*.92,r:25+R()*5});}return out;}},
    {id:'guard',name:'守護',hint:'硬い殻が、柔らかい中身を守る。',par:3,build:()=>{const out=hex(360,450,3,3,60,['jelly','beadslime','sponge'],25,30),n=12;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;out.push({m:i%3===0?'kohaku':'chalk',x:360+Math.cos(a)*145,y:450+Math.sin(a)*130,r:26+R()*4});}return out;}},
    {id:'mixed',name:'混成',hint:'雷は、濡れた素材を伝う。',par:3,build:()=>{const out=[];for(let j=0;j<4;j++)for(let i=0;i<7;i++){const wet=(i+j)%3!==0;out.push({m:wet?pick(['jelly','beadslime','sponge','soap']):pick(['sand','chalk','wax']),x:90+i*90+(j&1?28:0)+(R()-.5)*10,y:330+j*78+(R()-.5)*10,r:25+R()*6});}return out;}}
  ];
  C.spawnFormation=(f,hero,drift=16)=>{
    const W=L.world,list=f.build(hero),ids=[];
    for(const e of list){const b=W.spawn(e.m,e.x,e.y,e.r,{variant:'grunt',lod:'book',extra:{hp:C.MAT[e.m].armor?2:1,formation:f.id,drift:{x:0,y:f.around?0:drift},pop:0}});if(b)ids.push(b.id);}
    return {def:f,ids,start:L.time,actions:0,cleared:false,total:ids.length};
  };

  // Giant multi-layer boss: outer kohaku crust (hard) → middle soap (cuts clean, conducts) → bead-slime core.
  function wedge(r0,r1,a0,a1,steps=6){const pts=[];for(let i=0;i<=steps;i++){const a=a0+(a1-a0)*i/steps;pts.push({x:Math.cos(a)*r1,y:Math.sin(a)*r1});}for(let i=steps;i>=0;i--){const a=a0+(a1-a0)*i/steps;pts.push({x:Math.cos(a)*r0,y:Math.sin(a)*r0});}
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),mx=Math.min(...xs),my=Math.min(...ys),sx=Math.max(...xs)-mx||1,sy=Math.max(...ys)-my||1;return pts.map(p=>({...p,u:(p.x-mx)/sx,v:(p.y-my)/sy}));}
  C.spawnBoss=()=>{
    const W=L.world,cx=360,cy=470,boss={cx,cy,parts:[],layers:[[],[],[]],core:null,start:L.time,phase:0};
    const core=W.spawn('beadslime',cx,cy,104,{variant:'boss',extra:{hp:5,hpMax:5,bossLayer:2,bossPart:true}});boss.core=core;boss.layers[2].push(core.id);
    const layers=[{m:'kohaku',r0:150,r1:212,n:12,layer:0,hp:2,tex:'xsec/kohaku_crust'},{m:'soap',r0:104,r1:150,n:8,layer:1,hp:1,tex:'xsec/soap'}];
    for(const Ly of layers)for(let i=0;i<Ly.n;i++){const a0=i/Ly.n*Math.PI*2+.03,a1=(i+1)/Ly.n*Math.PI*2-.03,poly=wedge(Ly.r0,Ly.r1,a0,a1),c=L.slice.centroid(poly);
      const b=W.spawn(Ly.m,cx,cy,0,{poly:poly.map(p=>({...p})),texture:Ly.tex,boss:true,extra:{hp:Ly.hp,hpMax:Ly.hp,bossLayer:Ly.layer,bossPart:true,orbit:{a:Math.atan2(c.y,c.x),d:Math.hypot(c.x,c.y)}}});if(b)boss.layers[Ly.layer].push(b.id);}
    return boss;
  };
  // Only the outermost remaining layer can be broken; inner layers deflect until exposed.
  C.bossLocked=(boss,b)=>{if(!b.bossPart)return false;for(let l=0;l<b.bossLayer;l++)if(boss.layers[l].some(id=>L.world.bodies.some(x=>x.id===id&&!x.active&&!x.removed)))return true;return false;};
})(window.LAB);
