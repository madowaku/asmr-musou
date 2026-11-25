(function (L) {
  'use strict';
  if(new URLSearchParams(location.search).get('slasher')!=='iai')return;
  const C=L.combat,W=L.world,K=C.crunch;
  const STILL=.12, OPEN=.24, LINGER=.40;
  const marks=[];
  const limit=(v,min,max)=>Math.max(min,Math.min(max,v));
  const at=(mark,t)=>({x:mark.a.x+(mark.b.x-mark.a.x)*t,y:mark.a.y+(mark.b.y-mark.a.y)*t});
  const original=C.slash;
  L.clearHooks.push(()=>{marks.length=0;});
  C.iai={help:'スワイプで居合。ひと呼吸の後、斬った順に断面が開く。長押しで回転斬り。'};

  function split(e,mark,id,hero) {
    const {ux,uy,nx,ny}=mark, x=e.x,y=e.y, r=e.radius*3;
    C.hit(e,()=>{
      const line=[{x:x-ux*r,y:y-uy*r},{x:x+ux*r,y:y+uy*r}];
      const parts=W.cut(e,line,1830,{spread:.65,push:{x:ux*60,y:uy*60},action:id,cause:'iai',stop:.008});
      if(!parts?.length)return;
      for(const part of parts){
        const side=Math.sign((part.x-x)*nx+(part.y-y)*ny)||1;
        const offset=limit(e.radius*.19,5,17);
        part.x+=nx*side*offset;part.y+=ny*side*offset;
        part.spin*=.27;
        part.dirty=true;
      }
    },{action:id,dmg:K.power(hero),from:{x:x-nx*e.radius,y:y-ny*e.radius}});
  }

  C.slash=(hero,anchor,ux,uy,options={})=>{
    if(hero.cls!=='slasher'||options.sub)return original(hero,anchor,ux,uy,options);
    const G=C.state, {L0,w,c}=C.slashBand(hero,anchor,ux,uy,options);
    const nx=-uy,ny=ux,pool=C.targets().filter(e=>e.y>125&&e.y<K.LINE+e.radius);
    const ends=center=>[
      {x:center.x-ux*L0/2,y:center.y-uy*L0/2},
      {x:center.x+ux*L0/2,y:center.y+uy*L0/2}
    ];
    let [a,b]=ends(c);
    let targets=pool.filter(e=>C.segDist(e,a,b)<=e.radius+w);
    if(!targets.length){
      let best=null;
      for(const e of pool){
        const across=(e.x-c.x)*nx+(e.y-c.y)*ny;
        const along=(e.x-c.x)*ux+(e.y-c.y)*uy;
        if(Math.abs(along)<=L0*.5+60&&Math.abs(across)<=w+e.radius+125&&
           (best===null||Math.abs(across)<Math.abs(best)))best=across;
      }
      if(best!==null){
        [a,b]=ends({x:c.x+nx*best,y:c.y+ny*best});
        targets=pool.filter(e=>C.segDist(e,a,b)<=e.radius+w);
      }
    }
    const order=targets.map(e=>({e,t:limit(((e.x-a.x)*ux+(e.y-a.y)*uy)/L0,0,1)})).sort((i,j)=>i.t-j.t);
    C.begin(hero,'iai',{at:c});
    const id=hero.action, mark={a,b,ux,uy,nx,ny,at:G.t,wide:hero.ups.has('wide'),width:w};
    if(marks.length>=6)marks.shift();
    marks.push(mark);
    const from=C.clampP(a),to=C.clampP(b);
    hero.x=from.x;hero.y=from.y;
    C.moveTo(hero,to,.09);

    C.later(STILL,()=>{
      C.sfx('slash',{x:c.x,combo:1,n:order.length,wide:mark.wide});
    });
    order.forEach(({e,t},i)=>C.later(STILL+.018+t*OPEN+i*.006,()=>split(e,mark,id,hero)));

    if(hero.ups.has('wave')||hero.ups.has('double')){
      // The second sweep stays behind the first reveal so the original line
      // and its material cadence can be read even at max level.
      const echo=hero.ups.has('double')?1.02:0;
      C.later(STILL+OPEN+.10,()=>{
        if(hero!==G.hero)return;
        original(hero,null,ux*Math.cos(echo)-uy*Math.sin(echo),ux*Math.sin(echo)+uy*Math.cos(echo),
          {sub:true,center:c,len:L0*.73,w:w*.72,id});
      });
    }
    return true;
  };

  C.drawIai=r=>{
    const now=C.state.t;
    for(let i=marks.length-1;i>=0;i--){
      const age=now-marks[i].at;
      if(age>STILL+OPEN+LINGER)marks.splice(i,1);
    }
    for(const mark of marks){
      const age=now-mark.at, k=limit((age-STILL)/OPEN,0,1), head=at(mark,k);
      const alpha=limit(1-Math.max(0,age-STILL-OPEN)/LINGER,0,1);
      // A narrow ink line gives immediate aim feedback. Only the travelling
      // reveal is bright, so the quiet beat reads even with audio muted.
      r.line(mark.a,mark.b,2,[.25,.37,.64,.58*alpha]);
      if(age<STILL)continue;
      const ahead=at(mark,limit(k-.16,0,1));
      const tint=mark.wide?[.76,.42,.18]:[.20,.54,.78];
      r.line(mark.a,head,4,[...tint,.62*alpha]);
      r.flash(ahead,head,10,[...tint,.86*alpha]);
      r.glow(head.x,head.y,30,[...tint,.62*alpha]);
    }
  };
})(window.LAB);
