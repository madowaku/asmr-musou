(function(L){
  'use strict';
  const sources=new Map();
  function placeholder(name){
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),jelly=name.startsWith('jelly'),core=name.includes('core');
    const grad=g.createRadialGradient(77,49,3,136,127,175);
    if(jelly){grad.addColorStop(0,'#b9fff0');grad.addColorStop(.24,'#43d8c9');grad.addColorStop(.65,'#178f9c');grad.addColorStop(1,'#143b64');}
    else if(core){grad.addColorStop(0,'#fff9d5');grad.addColorStop(1,'#c69964');}
    else{grad.addColorStop(0,'#fff0be');grad.addColorStop(.32,'#e8b164');grad.addColorStop(.76,'#ba7144');grad.addColorStop(1,'#623d35');}
    g.fillStyle=grad;g.fillRect(0,0,256,256);
    // Opaque sprite-space texture: the actual silhouette is the geometric mesh.
    for(let i=0;i<150;i++){const x=(i*73)%256,y=(i*107)%256;g.fillStyle=jelly?'#baffee22':'#fff4cf15';g.beginPath();g.ellipse(x,y,jelly?1.6:.7,jelly?2.5:.7,0,0,Math.PI*2);g.fill();}
    if(!core){g.save();g.translate(91,54);g.rotate(-.4);const shine=g.createRadialGradient(0,0,0,0,0,58);shine.addColorStop(0,jelly?'#e4fffacc':'#fff9dc99');shine.addColorStop(1,'#ffffff00');g.scale(1,.27);g.fillStyle=shine;g.fillRect(-60,-60,120,120);g.restore();}
    return c;
  }
  L.textureNames={wax_body:'body/wax_boss',jelly_body:'body/jelly_boss',wax_core:'xsec/wax'};
  L.tex=name=>{const key=L.textureNames[name]||name;if(!sources.has(key))sources.set(key,placeholder(name));return sources.get(key);};
  L.assetStatus={bundled:0,failed:[],ready:false};
  L.loadAssets=async()=>{
    await Promise.all(Object.entries(window.LAB_ASSETS||{}).map(async([name,url])=>{try{const im=new Image();im.src=url;await im.decode();sources.set(name,im);L.assetStatus.bundled++;}catch(_){L.assetStatus.failed.push(name);}}));
    L.assetStatus.ready=true;
  };
})(window.LAB);
