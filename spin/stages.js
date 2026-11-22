/* SPIN LAB spawn schedules. Angles in degrees: 0 = up (screen top), clockwise positive.
 * Main run: fixed 60 s structure (spec §6), seeded so a run and its bot replays are reproducible.
 * Research stages A/B/C: fixed placements (spec §9). */
(function(L){
  'use strict';
  const S=L.spin=L.spin||{};
  const grp=(ev,t,ang,n,mats,o={})=>ev.push({t,type:'group',ang,n,mats,spread:o.spread??26,spd:o.spd??92,r0:o.r0??600,depth:o.depth??70});
  const item=(ev,t,ang,o={})=>ev.push({t,type:'item',ang,spd:o.spd??78,r0:o.r0??600,rel:!!o.rel,hint:o.hint});
  const clump=(ev,t,ang,mats,o={})=>ev.push({t,type:'clump',ang,mats,spd:o.spd??80,r0:o.r0??620,rows:o.rows??3});
  const arc=(ev,t,ang,width,n,mats,o={})=>ev.push({t,type:'arc',ang,width,n,mats,spd:o.spd??80,r0:o.r0??600});

  S.buildMain=rnd=>{
    const ev=[],pick=a=>a[Math.floor(rnd()*a.length)];let ang=rnd()*360,t=.6;
    const turn=(a=90,b=150)=>{ang=(ang+(rnd()<.5?1:-1)*(a+rnd()*(b-a))+360)%360;return ang;};
    // 0–10 s: wax only — learn rotate + auto-slash
    while(t<10){grp(ev,t,turn(),3+Math.floor(rnd()*3),['wax'],{spd:96});t+=1.45+rnd()*.35;}
    // 10–20 s: first growth items. The first one comes from wherever the player is FACING (so it would be cut):
    // the player discovers that turning the back to it saves it.
    item(ev,10.4,0,{rel:true,spd:70,hint:true});
    while(t<20){grp(ev,t,turn(),4+Math.floor(rnd()*3),['wax','wax','wax','jelly'],{spd:98});t+=1.35+rnd()*.3;}
    item(ev,14.6,(ang+180)%360,{spd:76});item(ev,18.4,turn(60,120),{spd:76});
    // 20–35 s: enemies and items mixed — items ride just behind a group, so "break, then turn the back"
    let nextItem=22;
    while(t<35){const a=turn(80,170);grp(ev,t,a,5+Math.floor(rnd()*3),['wax','wax','jelly'],{spd:100});
      if(rnd()<.45)grp(ev,t+.4,(a+150+rnd()*60)%360,3,['wax','jelly'],{spd:100});
      if(t>=nextItem){item(ev,t+.2,a+(rnd()-.5)*12,{r0:720,spd:96});nextItem+=3.4+rnd()*.8;}
      t+=1.2+rnd()*.25;}
    // 35–50 s: horde with ice clumps (shard chains) and jelly (bouncy approach, pushes neighbours)
    nextItem=37;
    while(t<50){const a=turn(70,160);
      if(rnd()<.45)clump(ev,t,a,['kohaku','kohaku','kohaku','wax'],{rows:3});
      else grp(ev,t,a,6+Math.floor(rnd()*3),['wax','jelly','jelly','kohaku'],{spd:104,spread:34});
      if(rnd()<.4)grp(ev,t+.5,(a+120+rnd()*120)%360,4,['wax','jelly'],{spd:104});
      if(t>=nextItem){item(ev,t+.6,turn(100,170),{spd:84});nextItem+=3.6+rnd()*.8;}
      t+=1.05+rnd()*.2;}
    // 50–60 s: rush — dense from everywhere; the grown sword should now feel like a mower
    while(t<58){const a=turn(60,170);
      if(rnd()<.35)arc(ev,t,a,110+rnd()*50,10+Math.floor(rnd()*4),['wax','wax','jelly','kohaku'],{spd:110});
      else if(rnd()<.4)clump(ev,t,a,['kohaku','kohaku','wax','jelly'],{rows:3,spd:96});
      else grp(ev,t,a,7+Math.floor(rnd()*3),['wax','wax','jelly','kohaku'],{spd:112,spread:40});
      t+=.62+rnd()*.15;}
    item(ev,51,turn(120,180),{spd:90});item(ev,55,turn(120,180),{spd:90});
    return ev.sort((a,b)=>a.t-b.t);
  };

  S.STAGES={
    A:{name:'A 初めての背中',goal:'前で壊してしまうものを、背中なら受け取れる。',hint:'光るものが来た。背中の袋で受け取ろう。',
      build:()=>{const ev=[];grp(ev,.4,0,1,['wax'],{spread:0,spd:120,depth:0});grp(ev,1.4,-14,1,['wax'],{spread:0,spd:120,depth:0});grp(ev,2.4,14,1,['wax'],{spread:0,spd:120,depth:0});item(ev,4.2,0,{spd:72,hint:true});return ev;}},
    B:{name:'B どちらを向く？',goal:'攻撃と回収を、向きだけで切り替えられる。',hint:'左の敵を斬りながら、右のアイテムを背中で。',
      build:()=>{const ev=[];grp(ev,.4,270,4,['wax'],{spread:22,spd:86,depth:40});item(ev,.4,90,{spd:86,hint:true});grp(ev,.4,90,4,['wax','jelly'],{spread:24,spd:86,r0:820,depth:40});
        grp(ev,5.5,0,3,['wax'],{spread:20,spd:92});item(ev,5.6,180,{spd:80});return ev;}},
    C:{name:'C 破壊のご褒美',goal:'アイテムを壊さずに取るほど、敵を派手に壊せる。',hint:'先に2つ受け取ってから、正面の大群へ。',
      build:()=>{const ev=[];item(ev,.3,90,{spd:96,hint:true});item(ev,1.8,270,{spd:96});
        arc(ev,4.6,0,148,17,['wax','kohaku','wax','jelly','kohaku'],{spd:78,r0:640});clump(ev,4.6,0,['kohaku','kohaku','kohaku'],{rows:2,r0:760,spd:78});
        arc(ev,9.5,180,130,12,['wax','jelly','kohaku'],{spd:84});return ev;}}
  };
})(window.LAB);
