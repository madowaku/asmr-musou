(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const W=720,H=1280,TOTAL=45, TAU=Math.PI*2;
  const COLORS={wax:['#ffc4db','#f389bb','#a95797'],bubble:['#aaf9ef','#4acbc6','#288aab'],jelly:['#d6c4ff','#a784ed','#6d54be'],ice:['#b6e8ff','#6ba8ee','#5579c5'],boss:['#ffdfac','#f9a1c1','#bc72a8']};
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dist=(x,y,x2,y2)=>Math.hypot(x-x2,y-y2);
  let state='menu',enemies=[],particles=[],texts=[],ripples=[],slashes=[],elapsed=0,score=0,kills=0,combo=0,maxCombo=0,lastKill=-5,spawnClock=0,bossSpawned=false,lastFrame=0,clock=0,wave=1,shake=0,uid=1;
  let pointer=null,hover=null,soundOn=true;
  let AC=null, noise=null;
  function audioInit(){if(!soundOn)return;try{AC ||= new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended') AC.resume();if(!noise){noise=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate);let d=noise.getChannelData(0);for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1}}catch(_){soundOn=false;$('sound').textContent='🔇'}}
  function tone(freq,duration=0.09,level=0.045,type='sine',endFreq=freq,delay=0){if(!AC||!soundOn)return;const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+duration+.015)}
  function hiss(duration=.08,level=.06,cutoff=1600,delay=0){if(!AC||!soundOn||!noise)return;const t=AC.currentTime+delay,src=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();src.buffer=noise;f.type='bandpass';f.frequency.value=cutoff;f.Q.value=.65;g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);src.connect(f).connect(g).connect(AC.destination);src.start(t);src.stop(t+duration+.01)}
  function sfx(type,finish=false){if(!AC||!soundOn)return;
    if(type==='wax'||type==='boss'){hiss(.055,finish?.12:.055,2450);tone(finish?740:390,.10,.027,'triangle',finish?155:260);if(finish){hiss(.11,.1,4300,.035);tone(970,.19,.035,'sine',490,.04)}}
    if(type==='bubble'){tone(rnd(480,680),.105,.08,'sine',rnd(125,260));hiss(.032,.035,3200)}
    if(type==='jelly'){tone(210,.24,.064,'sine',70);tone(455,.12,.03,'sine',170,.06);hiss(.14,.025,480)}
    if(type==='ice'){hiss(.09,.085,5600);tone(1140,.4,.045,'sine',430);if(finish)tone(1600,.5,.04,'sine',720,.045)}
    if(type==='squish'){tone(150,.23,.07,'sine',62);hiss(.17,.035,490)}
  }
  function createEnemy(type,x=rnd(80,640),y=-80){let radius= type==='boss'?100:type==='bubble'?47:type==='jelly'?55:type==='ice'?49:54;
    return {id:uid++,type,x,y,baseX:x,r:radius,vy:rnd(43,95),sway:rnd(16,52),phase:rnd(0,TAU),rate:rnd(.75,1.65),hp:type==='boss'?7:type==='wax'?3:type==='ice'?2:1,maxHp:type==='boss'?7:type==='wax'?3:type==='ice'?2:1,lastHit:-5,pressure:0,boing:0,rotation:rnd(-.25,.25),dead:false};}
  function addEnemy(type,x,y){const e=createEnemy(type,x,y);enemies.push(e);return e}
  function burst(x,y,color,count=14,power=180,shape='dot'){for(let i=0;i<count;i++){let a=rnd(0,TAU),sp=rnd(power*.3,power);particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rnd(0,85),life:rnd(.35,.8),max:.8,size:rnd(3,10),color,shape,angle:rnd(0,TAU),spin:rnd(-6,6)});}}
  function popup(x,y,word,color='#fff'){texts.push({x,y,word,color,life:.72,vy:-65})}
  function ripple(x,y,r,color,thick=5){ripples.push({x,y,r,life:.35,max:.35,color,thick})}
  function comboAdd(x,y,type){kills++;const time=elapsed;if(time-lastKill<2.2)combo++;else combo=1;lastKill=time;maxCombo=Math.max(combo,maxCombo);score+=100+Math.min(500,(combo-1)*15)+(type==='boss'?1000:0);if(combo>2&&combo%5===0)popup(x,y-90,`${combo} COMBO!`,'#ffdf8d')}
  function destroy(e,reason='hit',chain=true){if(e.dead)return;e.dead=true;const type=e.type,c=COLORS[type][0];comboAdd(e.x,e.y,type);sfx(reason==='squish'?'squish':type,true);shake=Math.max(shake,type==='boss'?17:6);burst(e.x,e.y,c,type==='boss'?65:22,type==='boss'?340:200,(type==='wax'||type==='ice'||type==='boss')?'shard':'dot');ripple(e.x,e.y,e.r*.65,c,8);popup(e.x,e.y-e.r*.7,reason==='squish'?'MUGYU!':({wax:'PARI!',bubble:'POP!',jelly:'PUNI!',ice:'CRACK!',boss:'SUPER CRACK!!'})[type],c);
    if(type==='bubble'&&chain){for(const b of enemies){if(b!==e&&!b.dead&&b.type==='bubble'&&dist(e.x,e.y,b.x,b.y)<135){b.dead=true;comboAdd(b.x,b.y,'bubble');burst(b.x,b.y,COLORS.bubble[0],12,155);ripple(b.x,b.y,30,COLORS.bubble[0]);popup(b.x,b.y-30,'POP!','#aaf9ef');tone(rnd(400,900),.11,.032,'sine',160,rnd(.02,.1));}}}
    if(type==='boss')popup(W/2,530,'BOSS DOWN!','#fff6af');
  }
  function strike(e,kind='tap'){if(!e||e.dead||elapsed-e.lastHit<.13)return;e.lastHit=elapsed;e.hp--;e.boing=1;ripple(e.x,e.y,e.r*.35,COLORS[e.type][0]);burst(e.x+rnd(-18,18),e.y+rnd(-18,18),'#ffffff',5,110,'shard');
    if(e.hp<=0){destroy(e);return} sfx(e.type,false);
    if(e.type==='wax'||e.type==='boss'||e.type==='ice')popup(e.x,e.y-e.r*.6,kind==='slash'?'KIRI!':'PAKI!','#fbeefa');
  }
  function targetAt(x,y){for(let i=enemies.length-1;i>=0;i--){let e=enemies[i];if(!e.dead&&dist(x,y,e.x,e.y)<e.r*1.23)return e}return null}
  function closestSegment(x,y,x1,y1,x2,y2){let dx=x2-x1,dy=y2-y1,t=clamp(((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy||1),0,1);return dist(x,y,x1+t*dx,y1+t*dy)}
  function slash(x1,y1,x2,y2){slashes.push({x1,y1,x2,y2,life:.16});for(const e of enemies){if(!e.dead&&closestSegment(e.x,e.y,x1,y1,x2,y2)<e.r*.97)strike(e,'slash')}}
  function pos(ev){let rect=canvas.getBoundingClientRect();return{x:(ev.clientX-rect.left)*W/rect.width,y:(ev.clientY-rect.top)*H/rect.height}}
  function down(ev){if(state!=='play')return;ev.preventDefault();if(pointer)return;audioInit();canvas.setPointerCapture(ev.pointerId);let p=pos(ev);pointer={id:ev.pointerId,x:p.x,y:p.y,lastX:p.x,lastY:p.y,startX:p.x,startY:p.y,start:elapsed,drag:false,pressureDone:false,target:targetAt(p.x,p.y)};hover=pointer.target}
  function move(ev){if(state!=='play'||!pointer||ev.pointerId!==pointer.id)return;ev.preventDefault();let p=pos(ev);if(dist(p.x,p.y,pointer.startX,pointer.startY)>22)pointer.drag=true;if(pointer.drag){slash(pointer.lastX,pointer.lastY,p.x,p.y);pointer.target=null;}pointer.lastX=pointer.x;pointer.lastY=pointer.y;pointer.x=p.x;pointer.y=p.y}
  function up(ev){if(state!=='play'||!pointer||ev.pointerId!==pointer.id)return;ev.preventDefault();if(!pointer.drag&&!pointer.pressureDone&&pointer.target)strike(pointer.target,'tap');pointer=null;hover=null}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  function begin(){audioInit();enemies=[];particles=[];texts=[];ripples=[];slashes=[];elapsed=0;clock=0;score=0;kills=0;combo=0;maxCombo=0;lastKill=-5;spawnClock=0;bossSpawned=false;wave=1;shake=0;pointer=null;state='play';$('menu').classList.add('hidden');$('result').classList.add('hidden');$('hud').classList.remove('hidden');for(let i=0;i<7;i++)addEnemy(['wax','bubble','jelly'][i%3],rnd(70,650),rnd(350,1060));refreshHUD()}
  function finish(){state='result';pointer=null;$('hud').classList.add('hidden');$('final-score').textContent=score.toLocaleString('ja-JP');$('final-kills').textContent=kills;$('final-combo').textContent=maxCombo;$('result').classList.remove('hidden')}
  function refreshHUD(){$('score').textContent=String(score).padStart(6,'0');$('time').textContent=Math.ceil(Math.max(0,TOTAL-elapsed));$('progress-fill').style.width=`${100*(1-elapsed/TOTAL)}%`;$('wave').textContent=`WAVE ${wave} / 3`;$('combo').textContent=combo>1?`×${combo} COMBO ✦`:'JUST RELAX ✦'}
  $('start').addEventListener('click',begin);$('retry').addEventListener('click',begin);$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').textContent=soundOn?'🔊':'🔇';if(soundOn)audioInit()});
  function update(dt){clock+=dt;particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;p.vx*=1-dt*.9;p.angle+=p.spin*dt;return p.life>0});texts=texts.filter(t=>{t.life-=dt;t.y+=t.vy*dt;return t.life>0});ripples=ripples.filter(r=>(r.life-=dt)>0);slashes=slashes.filter(s=>(s.life-=dt)>0);shake*=Math.max(0,1-dt*12);
    if(state!=='play')return;elapsed=Math.min(TOTAL,elapsed+dt);wave=elapsed<15?1:elapsed<30?2:3;if(elapsed>=TOTAL){refreshHUD();finish();return}
    spawnClock-=dt;if(spawnClock<=0&&enemies.filter(e=>!e.dead).length<24){let types=wave===1?['wax','bubble','jelly']:wave===2?['wax','bubble','jelly','ice']:['bubble','wax','ice','jelly','ice'];addEnemy(types[Math.floor(rnd(0,types.length))],rnd(85,635),rnd(280,410));spawnClock=wave===1?.78:wave===2?.52:.41}
    if(elapsed>34&&!bossSpawned){bossSpawned=true;addEnemy('boss',W/2,390);popup(W/2,480,'BIG CRUNCH!','#ffe4b2');}
    for(const e of enemies){if(e.dead)continue;e.y+=e.vy*dt*(e.type==='boss'?.55:1);e.x=e.baseX+Math.sin(clock*e.rate+e.phase)*e.sway;e.boing=Math.max(0,e.boing-dt*3);if(e.y>H+e.r){e.y=295;e.baseX=rnd(85,635)} }
    if(pointer&&!pointer.drag&&pointer.target&&!pointer.target.dead){const e=pointer.target;if(elapsed-pointer.start>.18){e.pressure=clamp((elapsed-pointer.start-.18)/.44,0,1);if(e.pressure>=1&&!pointer.pressureDone){pointer.pressureDone=true;destroy(e,'squish')}}}
    if(!pointer){for(const e of enemies)e.pressure=0}enemies=enemies.filter(e=>!e.dead);refreshHUD();
  }
  function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
  function radial(x,y,r,colors){let g=ctx.createRadialGradient(x-r*.27,y-r*.34,r*.08,x,y,r*1.25);g.addColorStop(0,colors[0]);g.addColorStop(.58,colors[1]);g.addColorStop(1,colors[2]);return g}
  function background(){let gr=ctx.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#292443');gr.addColorStop(.55,'#33345e');gr.addColorStop(1,'#1d2742');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.2;for(let i=0;i<19;i++){let x=(i*203+83)%W,y=((i*161+140)%H);let r=21+(i%4)*22;ctx.fillStyle=i%2?'#9ad1ec':'#edb3d9';ctx.beginPath();ctx.arc(x+Math.sin(clock*.2+i)*17,y+Math.cos(clock*.17+i)*10,r,0,TAU);ctx.fill()}ctx.restore();
    ctx.save();ctx.strokeStyle='#c8d0ff12';ctx.lineWidth=2;for(let i=0;i<20;i++){let y=210+i*61+Math.sin(clock*.45+i)*5;ctx.beginPath();ctx.moveTo(10,y);ctx.lineTo(W-10,y);ctx.stroke()}for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(i*69,200);ctx.lineTo(i*69,H);ctx.stroke()}ctx.restore();
    let bottom=ctx.createLinearGradient(0,900,0,H);bottom.addColorStop(0,'#11142a00');bottom.addColorStop(1,'#101b3b9f');ctx.fillStyle=bottom;ctx.fillRect(0,900,W,380);
  }
  function eyeFace(r){ctx.fillStyle='#342845a9';ctx.beginPath();ctx.ellipse(-r*.25,-r*.04,r*.055,r*.095,0,0,TAU);ctx.ellipse(r*.25,-r*.04,r*.055,r*.095,0,0,TAU);ctx.fill();ctx.strokeStyle='#6d4f78ac';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,r*.09,r*.12,0,Math.PI);ctx.stroke();}
  function cracked(e){let damage=e.maxHp-e.hp;if(!damage)return;ctx.save();ctx.strokeStyle=e.type==='ice'?'#f6fbff':'#fff5ee';ctx.lineWidth=e.type==='boss'?5:4;ctx.lineCap='round';for(let i=0;i<damage*3;i++){let a=(i*2.399+e.id*.4),r=e.r*.1,x=Math.cos(a)*r,y=Math.sin(a)*r;ctx.beginPath();ctx.moveTo(x,y);for(let j=1;j<=4;j++){let k=r+j*e.r*.18,ang=a+Math.sin(j*1.7+i)*.17;ctx.lineTo(Math.cos(ang)*k,Math.sin(ang)*k)}ctx.stroke()}ctx.restore()}
  function drawEnemy(e){let c=COLORS[e.type],r=e.r;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation+Math.sin(clock*2+e.phase)*.05);let squ=1-e.pressure*.35+e.boing*.075;ctx.scale(1+(1-squ)*.7,squ);ctx.shadowColor='#0a153b7a';ctx.shadowBlur=21;ctx.shadowOffsetY=14;
    if(e.type==='bubble'){
      ctx.fillStyle=radial(0,0,r,c);ctx.beginPath();ctx.arc(0,0,r*.74,0,TAU);ctx.fill();ctx.shadowColor='transparent';for(let k=0;k<8;k++){let ang=k*TAU/8,r2=r*.66,rx=Math.cos(ang)*r2,ry=Math.sin(ang)*r2;ctx.fillStyle=radial(rx,ry,r*.34,c);ctx.beginPath();ctx.arc(rx,ry,r*.32,0,TAU);ctx.fill();ctx.strokeStyle='#d6ffffb0';ctx.lineWidth=2;ctx.stroke()}ctx.save();ctx.scale(.8,.8);eyeFace(r);ctx.restore();
    }else if(e.type==='ice'){
      ctx.fillStyle=radial(0,0,r,c);ctx.beginPath();for(let j=0;j<9;j++){let a=-Math.PI/2+j*TAU/9,rr=r*(j%2?.89:1.07);if(j===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#f6feffb0';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#ffffff2b';ctx.beginPath();ctx.moveTo(-r*.2,-r*.8);ctx.lineTo(r*.3,-r*.3);ctx.lineTo(-r*.6,-r*.2);ctx.closePath();ctx.fill();eyeFace(r);cracked(e);
    }else{
      ctx.fillStyle=radial(0,0,r,c);ctx.beginPath();for(let j=0;j<=52;j++){let a=j*TAU/52,rr=r*(1+.03*Math.sin(a*7+e.phase));if(j===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.fill();ctx.shadowColor='transparent';ctx.fillStyle='#ffffff44';ctx.beginPath();ctx.ellipse(-r*.28,-r*.4,r*.26,r*.13,-.65,0,TAU);ctx.fill();if(e.type==='wax'||e.type==='boss'){ctx.strokeStyle='#fff3ecc0';ctx.lineWidth=5;ctx.stroke();cracked(e)}eyeFace(r);
    }
    if(e.pressure>.04){ctx.beginPath();ctx.arc(0,0,r*1.23,-Math.PI/2,-Math.PI/2+TAU*e.pressure);ctx.lineWidth=9;ctx.strokeStyle='#fff0b3';ctx.shadowBlur=8;ctx.shadowColor='#fff2a0';ctx.stroke()}
    ctx.restore();}
  function effects(){for(let p of particles){ctx.save();ctx.globalAlpha=clamp(p.life/.58,0,1);ctx.fillStyle=p.color;ctx.translate(p.x,p.y);ctx.rotate(p.angle);if(p.shape==='shard'){ctx.beginPath();ctx.moveTo(-p.size*.6,-p.size);ctx.lineTo(p.size*.65,0);ctx.lineTo(-p.size*.2,p.size*.7);ctx.closePath();ctx.fill()}else{ctx.beginPath();ctx.arc(0,0,p.size*.7,0,TAU);ctx.fill()}ctx.restore()}
    for(let r of ripples){ctx.save();ctx.globalAlpha=r.life/r.max;ctx.strokeStyle=r.color;ctx.lineWidth=r.thick*(r.life/r.max);ctx.beginPath();ctx.arc(r.x,r.y,r.r+(1-r.life/r.max)*85,0,TAU);ctx.stroke();ctx.restore()}
    for(let s of slashes){ctx.save();ctx.lineCap='round';ctx.globalAlpha=s.life/.16;ctx.shadowBlur=26;ctx.shadowColor='#c0ffff';ctx.strokeStyle='#9af7ff';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.stroke();ctx.restore()}
    for(let t of texts){ctx.save();ctx.globalAlpha=clamp(t.life/.3,0,1);ctx.translate(t.x,t.y);ctx.scale(1+(1-t.life/.72)*.05,1+(1-t.life/.72)*.05);ctx.font='900 36px Trebuchet MS, system-ui';ctx.textAlign='center';ctx.strokeStyle='#30234eb5';ctx.lineWidth=8;ctx.strokeText(t.word,0,0);ctx.fillStyle=t.color;ctx.fillText(t.word,0,0);ctx.restore()}
    if(pointer&&!pointer.drag){ctx.save();ctx.strokeStyle='#d9ffff9c';ctx.lineWidth=4;ctx.setLineDash([11,10]);ctx.beginPath();ctx.arc(pointer.x,pointer.y,37+Math.sin(clock*7)*4,0,TAU);ctx.stroke();ctx.restore()}
  }
  function draw(){ctx.save();if(shake>1)ctx.translate(rnd(-shake,shake),rnd(-shake,shake));background();if(state==='menu'||state==='result'){
      const preview=[['wax',146,660],['bubble',520,660],['jelly',220,900],['ice',530,940],['boss',W/2,775]];
      for(const [type,x,y] of preview){let e=createEnemy(type,x,y);e.phase=x/90;e.y=y+Math.sin(clock*1.3+x)*10;e.baseX=x;e.rotation=Math.sin(clock+y)*.1;drawEnemy(e)}
    }else{enemies.sort((a,b)=>a.y-b.y);for(const e of enemies)drawEnemy(e)}effects();ctx.restore()}
  function frame(ms){const dt=lastFrame?clamp((ms-lastFrame)/1000,0,.045):0;lastFrame=ms;update(dt);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
  // Deterministic test hooks: not part of production UI.
  window.__asmrTest={getState:()=>({state,score,kills,combo,maxCombo,elapsed,enemies:enemies.map(e=>({id:e.id,type:e.type,hp:e.hp,x:e.x,y:e.y}))}),start:begin,hitAt:(x,y)=>strike(targetAt(x,y)),end:finish};
})();
