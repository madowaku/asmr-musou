const scale=[0,2,4,7,9,12,14,16,19,21,24]
const clamp=v=>Math.max(0,Math.min(1,v))
export function pitch(x,mode){
  const raw=24*clamp(x), i=scale.findIndex(v=>v>=raw)
  const hi=scale[i],lo=scale[Math.max(0,i-1)],u=hi===lo?0:(raw-lo)/(hi-lo)
  // Smooth monotonic attraction, with no jump at the midpoint between notes.
  const soft=u-Math.sin(2*Math.PI*u)*.77/(2*Math.PI)
  const semitone=mode===0?(u<.5?lo:hi):mode===1?raw:lo+(hi-lo)*soft
  return 196*2**(semitone/12)
}
export function glass(ctx,input,x,y,mode){
  const gain=ctx.createGain(),pan=ctx.createStereoPanner(), start=ctx.currentTime
  gain.gain.value=.00001;gain.gain.setTargetAtTime(.102,start,.075)
  gain.connect(pan).connect(input)
  const spectra=[[1,.18,.075,.035],[1,.05,.19,.05],[1,.23,.025,.12]]
  const parts=[1,1.003,2,3].map((ratio,i)=>{
    const osc=ctx.createOscillator(),amp=ctx.createGain()
    amp.gain.value=i?0:1;osc.frequency.value=pitch(x,mode)*ratio
    osc.connect(amp).connect(gain);osc.start();return {ratio,osc,amp}
  })
  function move(x,y,depth,mode){
    const t=ctx.currentTime, zone=clamp(y)*2, a=Math.floor(zone), b=Math.min(2,a+1), blend=zone-a
    const f=pitch(x,mode)
    parts.forEach(({osc,ratio,amp},i)=>{
      osc.frequency.setTargetAtTime(f*ratio,t,.028)
      const color=spectra[a][i]*(1-blend)+spectra[b][i]*blend
      amp.gain.setTargetAtTime(i?color*(.18+1.45*depth):1-.13*depth,t,.055)
    })
    pan.pan.setTargetAtTime((clamp(x)-.5)*1.25,t,.065)
  }
  move(x,y,0,mode)
  return {move,stop(){const t=ctx.currentTime;gain.gain.setTargetAtTime(.00001,t,.15)
    for(const {osc,amp} of parts){osc.stop(t+1.2);osc.onended=()=>{osc.disconnect();amp.disconnect()}}
    parts[0].osc.addEventListener('ended',()=>{pan.disconnect();gain.disconnect()})}}
}
