import {notes} from './chamber.js'
export const scaleHz=n=>notes[(n%5+5)%5]*2**Math.floor(n/5)
// ratio, level and relative decay: a plucked string, a struck bar and a pipe
// need different attacks as well as different overtone envelopes.
const colors=[
 [[1,1,1],[2.72,.21,.42],[4.08,.08,.24]],
 [[1,1,1],[2,.43,.52],[3,.26,.31],[4,.12,.19]],
 [[1,1,1],[4,.43,.26],[9,.11,.11]],
 [[.5,.27,.94],[1,1,1],[2,.46,.95],[3,.19,.87]],
 [[1,1,1],[2.01,.28,.59],[3.98,.17,.28]],
 [[1,1,1],[1.004,.22,.88],[2,.19,.62]]
]
export function orchestraSound(ctx){
 const input=ctx.createGain(),lim=ctx.createDynamicsCompressor(),master=ctx.createGain()
 lim.threshold.value=-20;lim.ratio.value=6;master.gain.value=.62
 input.connect(lim).connect(master).connect(ctx.destination)
 for(const [sec,x,amp] of [[.094,-.64,.18],[.175,.7,.13],[.286,-.38,.085],[.463,.4,.046]]){
   const d=ctx.createDelay(1),p=ctx.createStereoPanner(),v=ctx.createGain()
   d.delayTime.value=sec;p.pan.value=x;v.gain.value=amp;input.connect(d).connect(v).connect(p).connect(lim)
 }
 const active=new Set()
 function note(hero,hz,x,weight=1,delay=0,duration=[1.45,1.03,.58,1.25,.88,.96][hero]){
   if(active.size>=85)return
   const t=ctx.currentTime+delay,pan=ctx.createStereoPanner()
   pan.pan.value=(x-.5)*1.35;pan.connect(input);active.add(pan)
   const strength=.108*weight/Math.sqrt(1+active.size*.095)
   const attack=hero===3?.15:hero===5?.04:.008
   colors[hero].forEach(([r,a,decay],i)=>{
     const osc=ctx.createOscillator(),vol=ctx.createGain(),end=t+duration*decay
     osc.frequency.value=hz*r;vol.gain.value=.00001
     vol.gain.setValueAtTime(.00001,t);vol.gain.exponentialRampToValueAtTime(Math.max(.0001,a*strength),t+Math.min(attack,duration*decay*.4))
     if(hero===3)vol.gain.setValueAtTime(a*strength*.91,t+duration*.55)
     vol.gain.exponentialRampToValueAtTime(.00001,end);osc.connect(vol).connect(pan);osc.start(t);osc.stop(end+.015)
     osc.onended=()=>{osc.disconnect();vol.disconnect();if(i===0){active.delete(pan);pan.disconnect()}}
   })
 }
 return {input,master,note}
}
