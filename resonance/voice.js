// Tones share a pentatonic palette. Quiet tails overlap the next attack.
const ratios=[[1,2,2.99],[1,1.995],[1,2,4],[1,2,3],[1,1.5,2]]
const decay=[1.35,.48,.69,1.05,1.9]
export const pitches=[261.63,293.66,329.63,392,440,523.25,587.33,659.25]
export function instrument(ctx){
  const bus=ctx.createGain(), filter=ctx.createBiquadFilter(), limiter=ctx.createDynamicsCompressor(), master=ctx.createGain()
  filter.frequency.value=2450; filter.Q.value=.55; limiter.threshold.value=-19;limiter.ratio.value=8;master.gain.value=.62
  bus.connect(filter).connect(limiter).connect(master).connect(ctx.destination)
  let ends=[]
  function note(kind,hz,at,weight=1,length=1){
    ends=ends.filter(end=>end>ctx.currentTime)
    if(ends.length>=64)return
    const duration=decay[kind]*length, gain=ctx.createGain()
    const amp=.107*weight/Math.sqrt(1+ends.filter(end=>end>at).length*.27)
    gain.gain.setValueAtTime(.00001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.00002,amp),at+.013);gain.gain.exponentialRampToValueAtTime(.00001,at+duration)
    gain.connect(bus);ends.push(at+duration)
    ratios[kind].forEach((ratio,i)=>{
      const osc=ctx.createOscillator(), partial=ctx.createGain()
      osc.frequency.setValueAtTime(hz*ratio*(kind===1?1.12:1),at)
      if(kind===1)osc.frequency.exponentialRampToValueAtTime(hz*ratio,at+.075)
      partial.gain.value=[1,.24,.09][i];osc.connect(partial).connect(gain);osc.start(at);osc.stop(at+duration+.01)
      osc.onended=()=>{osc.disconnect();partial.disconnect();if(i===0)gain.disconnect()}
    })
  }
  return {note,master}
}
