/* Art inspection only: these six materials have generic fracture, not researched physics. */
(function(L){
  const names={soap:'石鹸',sand:'砂',sponge:'吸水スポンジ',chalk:'チョーク',beadslime:'粒入りスライム',kohaku:'琥珀糖'};
  const fx={soap:'soap_cube_a',sand:'sand_clump',sponge:'sponge_drop',chalk:'chalk_crumb_a',beadslime:'bead_a',kohaku:'kohaku_shard_a'};
  for(const [id,name] of Object.entries(names))L.registerMaterial({id,name,hardness:.5,layers:{shell:null,core:{}},crossSection:{width:18},
    init(){},onPress(){},update(){},onImpact(){},
    onCut(body,cut){for(let i=0;i<8;i++)L.addParticle({x:body.x,y:body.y,kind:L.fxSlots[fx[id]],size:5+L.random()*7,vx:(L.random()-.5)*240,vy:-60-L.random()*100,color:[1,1,1,1],life:L.timing.duration(id,'post')});L.events.emit(id==='sponge'?'flow':'crumble',{material:id,x:body.x,y:body.y,rate:8,area:body.area});}
  });
})(window.LAB);
