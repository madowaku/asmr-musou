const modes = [
  // frequency ratio, excitation amplitude, decay time (seconds to -60 dB)
  [[1,1,1.7],[2.01,.22,.96],[2.72,.12,.45],[4.08,.07,.26]], // crystal
  [[1,1,.65],[1.51,.14,.32],[2.38,.12,.22]], // water vessel
  [[1,1,.84],[3.05,.29,.19],[5.14,.10,.07]], // wooden tine
  [[1,1,1.1],[2.01,.26,.62],[3.99,.18,.30],[5.02,.09,.11]], // music box
  [[1,1,1.95],[1.003,.19,1.1],[2,.24,1.3],[3,.09,.83]] // glass rim
]
export const notes=[261.63,293.66,329.63,392,440,523.25,587.33,659.25,783.99,880]
export function makeStudio(ctx){
  const bus=ctx.createGain(), limiter=ctx.createDynamicsCompressor(), master=ctx.createGain()
  limiter.threshold.value=-21;limiter.ratio.value=5;master.gain.value=.65
  bus.connect(limiter).connect(master).connect(ctx.destination)
  const chamber=ctx.createConvolver(), wet=ctx.createGain(), rate=ctx.sampleRate
  const impulse=ctx.createBuffer(2,Math.round(rate*1.8),rate)
  for(let ch=0;ch<2;ch++){
    let seed=71+ch*29, smooth=0
    const data=impulse.getChannelData(ch)
    for(let i=Math.floor(rate*(.024+ch*.009));i<data.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0
      smooth=.73*smooth+.27*(seed/2147483648-1)
      data[i]=smooth*Math.exp(-4*i/rate)
    }
  }
  chamber.buffer=impulse;chamber.connect(wet).connect(limiter);bus.connect(chamber)
  const cache=new Map(), active=new Set()
  function sample(k,n,rich){
    const key=[k,n,rich].join('/')
    if(cache.has(key))return cache.get(key)
    // Render once at a modest native rate. Each partial rings down independently.
    const sr=16000, duration=rich?modes[k][0][2]:.9
    const buffer=ctx.createBuffer(1,Math.ceil(sr*duration),sr), data=buffer.getChannelData(0)
    for(const [ratio,amp,life] of rich?modes[k]:[[1,1,.9]]){
      const freq=notes[n]*ratio
      if(freq>4800)continue
      let phase=0, env=amp, fall=Math.exp(-6.91/(sr*life)),bend=.14
      const bendDecay=Math.exp(-1/(sr*.031))
      for(let i=0;i<data.length;i++){
        phase+=2*Math.PI*freq/sr*(1+(rich&&k===1?bend:0));bend*=bendDecay
        data[i]+=Math.sin(phase)*env;env*=fall
      }
    }
    const attack=k===4&&rich?.068:.007
    for(let i=0;i<data.length;i++)data[i]*=Math.min(1,i/(sr*attack),(data.length-i)/(sr*.016))
    cache.set(key,buffer);return buffer
  }
  function strike(k,n,x,at,weight,rich){
    if(active.size>=72)return
    const src=ctx.createBufferSource(), gain=ctx.createGain(), pan=ctx.createStereoPanner()
    src.buffer=sample(k,n,rich);gain.gain.value=.135*weight/Math.sqrt(1+.17*active.size)
    pan.pan.value=(x-.5)*1.35;src.connect(gain).connect(pan).connect(bus);active.add(src)
    src.onended=()=>{active.delete(src);src.disconnect();gain.disconnect();pan.disconnect()};src.start(Math.max(ctx.currentTime,at))
  }
  function bow(n,x,rich){
    const gain=ctx.createGain(), pan=ctx.createStereoPanner(), t=ctx.currentTime
    gain.gain.value=.00001;gain.gain.setTargetAtTime(.087,t,.14);pan.pan.value=x-.5;gain.connect(pan).connect(bus)
    const parts=(rich?[1,1.003,2]:[1]).map((r,i)=>{
      const osc=ctx.createOscillator(),vol=ctx.createGain();vol.gain.value=[1,.23,.17][i];osc.frequency.value=notes[n]*r;osc.connect(vol).connect(gain);osc.start();return {osc,r,vol}
    })
    return {move(n,x){for(const p of parts)p.osc.frequency.setTargetAtTime(notes[n]*p.r,ctx.currentTime,.06);pan.pan.setTargetAtTime(x-.5,ctx.currentTime,.07)},
      stop(){const end=ctx.currentTime;gain.gain.cancelAndHoldAtTime?.(end);gain.gain.setTargetAtTime(.00001,end,.07);for(const p of parts){p.osc.stop(end+.55);p.osc.onended=()=>{p.osc.disconnect();p.vol.disconnect()}}parts[0].osc.addEventListener('ended',()=>{gain.disconnect();pan.disconnect()})}}
  }
  return {strike,bow,master,space(long){wet.gain.setTargetAtTime(long?.4:.025,ctx.currentTime,.04)}}
}
