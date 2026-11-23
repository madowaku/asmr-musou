/* SOUND STAGES v0.6 — one new material per stage, so the ear learns one sound at a time.
 * Stage data, the material mix over the 60 s, patch-wise material placement, the material-themed boss,
 * the sound mix (new material in front of the hero sounds), and progress (clear → next material). */
(function(L){
  'use strict';
  const C=L.combat,S=C.stages={};
  // Introduction text: shown once, the first time the player meets the material.
  S.MATERIALS={
    wax:{jp:'ロウスクイーズ',sound:'パキッ、むにゅっ。',note:'表面はパキッと割れて、中はむにゅっとやわらかい。',col:'#ffb3c4'},
    jelly:{jp:'ゼリー',sound:'ぷるん、ぶちゅっ。',note:'ぷるぷる揺れて、つぶれると弾ける。',col:'#c9a6ff'},
    soap:{jp:'石鹸',sound:'サクサクッ。',note:'刃がすっと通る。切り口がなめらか。',col:'#9fe8c4'},
    chalk:{jp:'チョーク',sound:'ポキッ、ホロホロ。'},sand:{jp:'砂',sound:'ザザザッ。'},sponge:{jp:'吸水スポンジ',sound:'じゅわっ。'},
    beadslime:{jp:'粒入りスライム',sound:'ジャリむにゅ。'},kohaku:{jp:'琥珀糖',sound:'カリッ、ぷにっ。'}
  };
  // The order follows the brief; the offline feature analysis (tests/sound/analyze.mjs) found stages 1–3 well apart
  // (jelly↔wax 4.0, soap↔{wax,jelly} 3.8 on a z-scored feature distance), so it was kept.
  S.LIST=[
    {n:1,mat:'wax',known:[],title:'はじめての音',boss:['wax','wax','wax']},
    {n:2,mat:'jelly',known:['wax'],title:'やわらかい音',boss:['wax','jelly','jelly']},
    {n:3,mat:'soap',known:['wax','jelly'],title:'切る音',boss:['jelly','soap','soap']},
    {n:4,mat:'chalk',locked:true},{n:5,mat:'sand',locked:true},{n:6,mat:'sponge',locked:true},{n:7,mat:'beadslime',locked:true},{n:8,mat:'kohaku',locked:true}
  ];
  S.PLAYABLE=3;S.get=n=>S.LIST[Math.max(0,Math.min(S.PLAYABLE,n)-1)];
  // Phases: solo (the new material alone) → mostly new → half new. The new material stays the lead in every phase.
  S.PHASES=[{until:12,id:'solo',lead:1},{until:24,id:'mix',lead:.7},{until:99,id:'blend',lead:.5}];
  S.phaseAt=t=>S.PHASES.find(p=>t<p.until);
  S.mixAt=(st,t)=>{const p=S.phaseAt(t);if(!st.known.length||p.lead>=1)return [[st.mat,1]];const rest=(1-p.lead)/st.known.length;return [[st.mat,p.lead],...st.known.map(m=>[m,rest])];};
  // Materials are placed in contiguous patches (by angle around the group, or by column), never salt-and-pepper:
  // a swing through one patch sounds like one material; a swing across two patches plays A then B.
  S.assign=(list,mix,R)=>{if(mix.length===1){for(const e of list)e.m=mix[0][0];return list;}
    const cx=list.reduce((s,e)=>s+e.x,0)/list.length,cy=list.reduce((s,e)=>s+e.y,0)/list.length,rot=R()*Math.PI*2;
    const order=list.slice().sort((a,b)=>{const fa=(Math.atan2(a.y-cy,a.x-cx)-rot+Math.PI*4)%(Math.PI*2),fb=(Math.atan2(b.y-cy,b.x-cx)-rot+Math.PI*4)%(Math.PI*2);return fa-fb;});
    const sh=mix.slice().sort(()=>R()-.5);let i=0;for(const [m,w] of sh){const n=Math.round(w*list.length);for(let k=0;k<n&&i<order.length;k++)order[i++].m=m;}
    while(i<order.length)order[i++].m=mix[0][0];return list;};
  S.spawn=(f,hero,drift,mix)=>{const W=L.world,list=S.assign(f.build(hero),mix,L.random),ids=[];
    for(const e of list){const b=W.spawn(e.m,e.x,e.y,e.r,{variant:'grunt',lod:'book',extra:{hp:C.MAT[e.m].armor?2:1,formation:f.id,drift:{x:0,y:f.around?0:drift},pop:0}});if(b)ids.push(b.id);}
    return {def:f,ids,total:ids.length};};

  // Material-themed giant boss: same three-layer rule as v0.5 (outer → middle → core), materials from the stage.
  function wedge(r0,r1,a0,a1,steps=6){const pts=[];for(let i=0;i<=steps;i++){const a=a0+(a1-a0)*i/steps;pts.push({x:Math.cos(a)*r1,y:Math.sin(a)*r1});}for(let i=steps;i>=0;i--){const a=a0+(a1-a0)*i/steps;pts.push({x:Math.cos(a)*r0,y:Math.sin(a)*r0});}
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),mx=Math.min(...xs),my=Math.min(...ys),sx=Math.max(...xs)-mx||1,sy=Math.max(...ys)-my||1;return pts.map(p=>({...p,u:(p.x-mx)/sx,v:(p.y-my)/sy}));}
  const TEX={wax:'xsec/wax_shell',kohaku:'xsec/kohaku_crust'};
  S.spawnBoss=st=>{const W=L.world,[m0,m1,m2]=st.boss,cx=360,cy=470,boss={cx,cy,parts:[],layers:[[],[],[]],core:null,start:L.time,phase:0,mats:st.boss};
    const core=W.spawn(m2,cx,cy,104,{variant:'boss',extra:{hp:5,hpMax:5,bossLayer:2,bossPart:true}});boss.core=core;boss.layers[2].push(core.id);
    const layers=[{m:m0,r0:150,r1:212,n:12,layer:0,hp:2,tex:TEX[m0]||'xsec/'+m0},{m:m1,r0:104,r1:150,n:8,layer:1,hp:1,tex:'xsec/'+m1}];
    for(const Ly of layers)for(let i=0;i<Ly.n;i++){const a0=i/Ly.n*Math.PI*2+.03,a1=(i+1)/Ly.n*Math.PI*2-.03,poly=wedge(Ly.r0,Ly.r1,a0,a1),c=L.slice.centroid(poly);
      const b=W.spawn(Ly.m,cx,cy,0,{poly:poly.map(p=>({...p})),texture:Ly.tex,boss:true,extra:{hp:Ly.hp,hpMax:Ly.hp,bossLayer:Ly.layer,bossPart:true,orbit:{a:Math.atan2(c.y,c.x),d:Math.hypot(c.x,c.y)}}});if(b)boss.layers[Ly.layer].push(b.id);}
    return boss;};

  // The lead material always conducts the caster's lightning (v0.5: wet materials only). Stage 1 is all wax,
  // which is dry: without this the caster — the favourite of the v0.4 playtest — would be weakest on the first stage.
  const WET=Object.fromEntries(Object.entries(C.MAT).map(([m,v])=>[m,!!v.wet]));
  S.applyRules=st=>{for(const m of Object.keys(C.MAT))C.MAT[m].wet=WET[m]||(!!st&&m===st.mat);};

  // ---------- sound mix: the stage's material in front ----------
  // C.mix = {mat, boost (its voices), other (other materials), extra (voice-cap headroom for it), sfx (hero sounds)}.
  // 'v05' = the v0.5 mix (no focus, hero sounds at full level) for A/B listening (?mix=v05) and for the analysis.
  S.MIX={solo:{boost:1,other:1,extra:6,sfx:.62},mix:{boost:1.3,other:.8,extra:8,sfx:.7},blend:{boost:1.3,other:.8,extra:8,sfx:.7},boss:{boost:1.2,other:.9,extra:6,sfx:.6}};
  S.mixMode=(()=>{try{return new URLSearchParams(location.search).get('mix')==='v05'?'v05':'v06';}catch(_){return 'v06';}})();
  S.mixState=(st,t,boss)=>{if(S.mixMode==='v05'||!st)return null;const k=boss?'boss':S.phaseAt(t).id;return {mat:st.mat,...S.MIX[k],phase:k};};
  // Engine patch (shared by live audio and the offline renders): scales material voices by C.mix, gives the lead
  // material a little voice-cap headroom so a crowded moment drops other grains first. C.mix=null → v0.3/v0.5 behaviour.
  // C.stem (analysis only) renders one material: other voices still occupy the cap at an inaudible gain.
  const MAT_RE=/^synth_(?:grain_)?([a-z]+)/;
  function materialOf(name){const m=MAT_RE.exec(name);return m&&S.MATERIALS[m[1]]?m[1]:null;}
  S.patchEngine=()=>{const E=L.AudioEngine&&L.AudioEngine.Engine;if(!E||E.prototype.__stagePatched)return;const P=E.prototype,orig=P.play;P.__stagePatched=true;
    P.play=function(name,at,gain,...rest){const m=materialOf(name),x=C.mix,st=C.stem;
      if(st!=null&&m!==st)gain*=1e-9; // stem render: keep cap occupancy identical, silence the rest
      if(!x||!m)return orig.call(this,name,at,gain,...rest);
      if(m===x.mat){const cap=this.cap;this.cap=cap+(x.extra||0);try{return orig.call(this,name,at,gain*x.boost,...rest);}finally{this.cap=cap;}}
      return orig.call(this,name,at,gain*x.other,...rest);};};
  S.materialOf=materialOf;

  // ---------- progress (per viewer; storage may be unavailable) ----------
  const KEY='asmr-sound-v06';
  S.load=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return {cleared:v.cleared||[],seen:v.seen||[],best:v.best||{},plays:v.plays||{}};}catch(_){return {cleared:[],seen:[],best:{},plays:{}};}};
  S.save=v=>{try{localStorage.setItem(KEY,JSON.stringify(v));}catch(_){}};
  S.allOpen=(()=>{try{return new URLSearchParams(location.search).get('all')==='1';}catch(_){return false;}})();
  S.unlocked=(n,prog)=>!S.LIST[n-1].locked&&(n===1||S.allOpen||prog.cleared.includes(n-1));
})(window.LAB);
