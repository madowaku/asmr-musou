/* SPIN LAB sprites. Generated art (Codex image_gen via Luna, keyed and bundled by tools/spin/bundle-art.py into
 * spin/art-bundle.js as data URLs, so WebGL can use it from file:// too) wins; anything missing falls back to
 * the procedural sprites below, so the game always runs. All sprites face UP (θ = 0). */
(function(L){
  'use strict';
  const S=L.spin=L.spin||{};
  const art=window.SPIN_ART||{};
  function canvas(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');fn(g,w,h);return c.toDataURL('image/png');}
  const proc={
    // top-down hero, facing up; light-blue pouch on the back (bottom of the sprite)
    hero:()=>canvas(256,256,(g)=>{g.translate(128,128);
      const pouch=g.createRadialGradient(-10,46,6,0,52,52);pouch.addColorStop(0,'#e8f8ff');pouch.addColorStop(.6,'#8fd0f0');pouch.addColorStop(1,'#4b8fbf');
      g.fillStyle=pouch;g.beginPath();g.ellipse(0,54,50,40,0,0,7);g.fill();g.strokeStyle='#2f6b98';g.lineWidth=4;g.beginPath();g.ellipse(0,68,34,14,0,0,Math.PI);g.stroke();
      g.strokeStyle='#5a7fa8';g.lineWidth=5;g.beginPath();g.moveTo(-30,30);g.lineTo(-22,-6);g.moveTo(30,30);g.lineTo(22,-6);g.stroke();
      const sh=g.createLinearGradient(0,-30,0,30);sh.addColorStop(0,'#5b8fe0');sh.addColorStop(1,'#2d4f9a');g.fillStyle=sh;g.beginPath();g.ellipse(0,6,58,30,0,0,7);g.fill();
      const hd=g.createRadialGradient(-12,-14,4,0,0,40);hd.addColorStop(0,'#ffe3c8');hd.addColorStop(1,'#d9a882');g.fillStyle=hd;g.beginPath();g.arc(0,-2,34,0,7);g.fill();
      g.fillStyle='#3b2a44';g.beginPath();g.arc(0,6,34,.15*Math.PI,.85*Math.PI,false);g.arc(0,-2,36,Math.PI,0,true);g.fill();
      g.fillStyle='#ffffff55';g.beginPath();g.ellipse(-12,-18,12,6,-.4,0,7);g.fill();
      g.fillStyle='#ffd9b8';for(const s of [-1,1]){g.beginPath();g.arc(s*30,-26,10,0,7);g.fill();}}),
    // greatsword, blade up, guard near the bottom
    sword:()=>canvas(128,384,(g)=>{const bl=g.createLinearGradient(40,0,88,0);bl.addColorStop(0,'#bfe3ff');bl.addColorStop(.5,'#ffffff');bl.addColorStop(1,'#8fb8de');
      g.fillStyle=bl;g.beginPath();g.moveTo(64,6);g.lineTo(90,46);g.lineTo(86,316);g.lineTo(42,316);g.lineTo(38,46);g.closePath();g.fill();
      g.strokeStyle='#ffffffaa';g.lineWidth=3;g.beginPath();g.moveTo(64,20);g.lineTo(64,306);g.stroke();
      const gd=g.createLinearGradient(0,316,0,336);gd.addColorStop(0,'#ffe08a');gd.addColorStop(1,'#c98d32');g.fillStyle=gd;g.fillRect(14,316,100,20);
      g.fillStyle='#6b4b2e';g.fillRect(54,336,20,40);g.fillStyle='#ffe08a';g.beginPath();g.arc(64,378,8,0,7);g.fill();}),
    // growth item: warm faceted crystal with a sword glint
    item:()=>canvas(192,192,(g)=>{g.translate(96,96);const halo=g.createRadialGradient(0,0,10,0,0,92);halo.addColorStop(0,'#fff6d0cc');halo.addColorStop(.5,'#ffd27a55');halo.addColorStop(1,'#ffd27a00');g.fillStyle=halo;g.fillRect(-96,-96,192,192);
      const gem=g.createLinearGradient(-40,-60,40,60);gem.addColorStop(0,'#fff8d8');gem.addColorStop(.45,'#ffc56a');gem.addColorStop(1,'#7fe6c8');g.fillStyle=gem;
      g.beginPath();g.moveTo(0,-62);g.lineTo(44,-20);g.lineTo(30,50);g.lineTo(0,64);g.lineTo(-30,50);g.lineTo(-44,-20);g.closePath();g.fill();
      g.strokeStyle='#ffffffcc';g.lineWidth=3;g.stroke();g.strokeStyle='#ffffff77';g.lineWidth=2;g.beginPath();g.moveTo(-44,-20);g.lineTo(0,-6);g.lineTo(44,-20);g.moveTo(0,-6);g.lineTo(0,64);g.stroke();
      g.fillStyle='#ffffff';g.beginPath();g.moveTo(0,-40);g.lineTo(6,-30);g.lineTo(5,18);g.lineTo(-5,18);g.lineTo(-6,-30);g.closePath();g.fill();g.fillRect(-14,18,28,5);}),
    // ice body / cut face (full-bleed; clipped by the enemy polygon). Replaces 琥珀糖 art on this page only.
    ice:()=>canvas(256,256,(g)=>{const d=g.createLinearGradient(0,0,256,256);d.addColorStop(0,'#f4fdff');d.addColorStop(.45,'#bfeaff');d.addColorStop(1,'#7fc4ec');g.fillStyle=d;g.fillRect(0,0,256,256);
      g.strokeStyle='#ffffffaa';g.lineWidth=2;for(let i=0;i<7;i++){g.beginPath();g.moveTo(40+i*30,20+(i*53)%200);g.lineTo(90+i*22,120+(i*37)%120);g.lineTo(60+i*28,240);g.stroke();}
      const sh=g.createRadialGradient(80,70,4,80,70,90);sh.addColorStop(0,'#ffffffcc');sh.addColorStop(1,'#ffffff00');g.fillStyle=sh;g.fillRect(0,0,256,256);}),
    icex:()=>canvas(256,256,(g)=>{g.fillStyle='#e9fbff';g.fillRect(0,0,256,256);g.strokeStyle='#9fdcff';g.lineWidth=3;for(let i=0;i<12;i++){g.beginPath();g.moveTo(i*24,0);g.lineTo(i*24+60,256);g.stroke();}}),
    floor:()=>canvas(512,512,(g)=>{g.fillStyle='#0a1217';g.fillRect(0,0,512,512);g.translate(256,256);
      const d=g.createRadialGradient(0,0,20,0,0,240);d.addColorStop(0,'#2a2c52');d.addColorStop(.7,'#1c1d3c');d.addColorStop(1,'#151730');g.fillStyle=d;g.beginPath();g.arc(0,0,240,0,7);g.fill();
      for(let r=40;r<=230;r+=38){g.strokeStyle='#ffffff10';g.lineWidth=2;g.beginPath();g.arc(0,0,r,0,7);g.stroke();}
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2;g.strokeStyle=i%6===0?'#b8a8ff22':'#ffffff08';g.beginPath();g.moveTo(Math.cos(a)*40,Math.sin(a)*40);g.lineTo(Math.cos(a)*236,Math.sin(a)*236);g.stroke();}
      g.strokeStyle='#8fd8ff30';g.lineWidth=4;g.beginPath();g.arc(0,0,238,0,7);g.stroke();})
  };
  S.artSource={};
  const out={};for(const k of Object.keys(proc)){out['spin/'+k]=art[k]||proc[k]();S.artSource[k]=art[k]?'generated':'procedural';}
  out['xsec/kohaku']=out['spin/icex'];out['xsec/kohaku_crust']=out['spin/ice'];
  Object.assign(window.LAB_ASSETS=window.LAB_ASSETS||{},out);
})(window.LAB);
