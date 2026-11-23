// Offline analysis of the v0.3 material sound bank: how different does each material sound?
// Renders every material's cut / impact / grain voices (all variants), measures simple perceptual features,
// and proposes an introduction order where each newcomer is as distinct as possible from what is already known.
// Output: research/v06/sound_features.json
import {createRequire} from 'node:module';import {writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const D=require(path.join(root,'lab/audio/dsp.js')),SR=48000,bank=D.makeBank(SR);
const MATS=['wax','jelly','soap','chalk','sand','sponge','beadslime','kohaku'];
const JP={wax:'ロウスクイーズ',jelly:'ゼリー',soap:'石鹸',chalk:'チョーク',sand:'砂',sponge:'吸水スポンジ',beadslime:'粒入りスライム',kohaku:'琥珀糖'};
const IMPACT={wax:'snap',jelly:'blip',soap:'clack',sand:'settle',sponge:'drip',chalk:'snap',beadslime:'plink',kohaku:'crust'};
// Naive DFT magnitude on 1024-sample frames (enough for a handful of short buffers).
const N=1024,win=Float64Array.from({length:N},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(N-1)));
const cosT=[],sinT=[];for(let k=0;k<N/2;k++){const c=new Float64Array(N),s=new Float64Array(N);for(let n=0;n<N;n++){c[n]=Math.cos(2*Math.PI*k*n/N);s[n]=Math.sin(2*Math.PI*k*n/N);}cosT.push(c);sinT.push(s);}
function spectrum(x,o){const m=new Float64Array(N/2);for(let k=1;k<N/2;k++){let re=0,im=0;const c=cosT[k],s=sinT[k];for(let n=0;n<N;n++){const v=(x[o+n]||0)*win[n];re+=v*c[n];im-=v*s[n];}m[k]=Math.hypot(re,im);}return m;}
function features(buf){
  const env=[];for(let i=0;i<buf.length;i+=240){let e=0;for(let j=i;j<Math.min(buf.length,i+240);j++)e+=buf[j]*buf[j];env.push(Math.sqrt(e/240));}
  const peak=Math.max(...env),pi=env.indexOf(peak),db=v=>20*Math.log10(v/peak+1e-9);
  let end=env.length-1;while(end>pi&&db(env[end])<-30)end--;
  const dur=(end+1)*240/SR,attack=pi*240/SR;
  // decay shape: fraction of energy in first 60 ms (clicky/snappy vs sustained)
  let tot=0,early=0;for(let i=0;i<env.length;i++){tot+=env[i]**2;if(i*240/SR<.06)early+=env[i]**2;}
  // spectrum over frames in the loud part
  const hop=512,mags=new Float64Array(N/2);let frames=0;for(let o=0;o+N<=Math.min(buf.length,(end+1)*240+N);o+=hop){const m=spectrum(buf,o);for(let k=0;k<m.length;k++)mags[k]+=m[k];frames++;}
  let sum=0,cen=0,logs=0,lo=0,hi=0;for(let k=1;k<N/2;k++){const f=k*SR/N,p=mags[k]**2;sum+=p;cen+=f*p;logs+=Math.log(mags[k]+1e-12);if(f<500)lo+=p;if(f>4000)hi+=p;}
  const centroid=cen/sum,flat=Math.exp(logs/(N/2-1))/(mags.reduce((a,b)=>a+b,0)/(N/2-1));
  // roughness: how many separate transients (grains/crackle) — count envelope peaks above -18 dB
  let bursts=0;for(let i=1;i<=end;i++)if(env[i]>env[i-1]*1.6&&db(env[i])>-18)bursts++;
  return {dur,attack,early:early/tot,centroid,flat,low:lo/sum,high:hi/sum,bursts};
}
const avg=list=>{const o={};for(const k of Object.keys(list[0]))o[k]=list.reduce((s,x)=>s+x[k],0)/list.length;return o;};
const per={};
for(const m of MATS){
  const kinds={cut:(m==='chalk'?'synth_chalk_snap':'synth_'+m+'_cut'),impact:'synth_'+m+'_'+IMPACT[m],grain:'synth_grain_'+m};
  per[m]={};for(const [k,name] of Object.entries(kinds)){if(!bank[name]){per[m][k]=null;continue;}per[m][k]={name,...avg(bank[name].map(features))};}
}
// Feature vector for distinctness: break voice (cut) dominates; grain voice second (that is what mass kills sound like).
const vec=m=>{const c=per[m].cut,g=per[m].grain;return [Math.log2(c.centroid),Math.log(c.dur),c.early,c.flat*2,c.low*2,c.high*2,Math.min(4,c.bursts)/2,Math.log2(g.centroid)*.6,g.flat*1.2];};
const V=Object.fromEntries(MATS.map(m=>[m,vec(m)])),dims=V.wax.length,mean=[],sd=[];
for(let d=0;d<dims;d++){const xs=MATS.map(m=>V[m][d]);mean[d]=xs.reduce((a,b)=>a+b)/xs.length;sd[d]=Math.sqrt(xs.reduce((a,b)=>a+(b-mean[d])**2,0)/xs.length)||1;}
const Z=Object.fromEntries(MATS.map(m=>[m,V[m].map((v,d)=>(v-mean[d])/sd[d])]));
const dist=(a,b)=>Math.sqrt(Z[a].reduce((s,v,d)=>s+(v-Z[b][d])**2,0));
const matrix=Object.fromEntries(MATS.map(a=>[a,Object.fromEntries(MATS.map(b=>[b,+dist(a,b).toFixed(2)]))]));
// Greedy order: start from the brief's stage 1 (wax); each next material maximises its minimum distance to the known set.
function greedy(first){const order=[first],left=MATS.filter(m=>m!==first),mins=[];while(left.length){let best=null,bv=-1;for(const m of left){const v=Math.min(...order.map(o=>dist(m,o)));if(v>bv){bv=v;best=m;}}order.push(best);mins.push(+bv.toFixed(2));left.splice(left.indexOf(best),1);}return {order,mins};}
const briefOrder=['wax','jelly','soap','chalk','sand','sponge','beadslime','kohaku'];
const briefMins=briefOrder.slice(1).map((m,i)=>+Math.min(...briefOrder.slice(0,i+1).map(o=>dist(m,o))).toFixed(2));
const out={materials:MATS,jp:JP,features:per,distance:matrix,briefOrder:{order:briefOrder,minDistToKnown:briefMins},greedyFromWax:greedy('wax')};
await mkdir(path.join(root,'research/v06'),{recursive:true});await writeFile(path.join(root,'research/v06/sound_features.json'),JSON.stringify(out,null,1));
const f2=x=>x.toFixed(2);
console.log('material   cut: dur  early cen(Hz) flat low  high bursts | grain cen');
for(const m of MATS){const c=per[m].cut,g=per[m].grain;console.log(m.padEnd(10),f2(c.dur),f2(c.early),Math.round(c.centroid).toString().padStart(6),f2(c.flat),f2(c.low),f2(c.high),c.bursts.toFixed(1),'|',Math.round(g.centroid));}
console.log('\ndistance');console.log('          '+MATS.map(m=>m.slice(0,6).padStart(7)).join(''));for(const a of MATS)console.log(a.padEnd(10)+MATS.map(b=>matrix[a][b].toFixed(2).padStart(7)).join(''));
console.log('\nbrief order',briefOrder.join(' → '),'min dist to known',briefMins.join(' '));
const g=greedy('wax');console.log('greedy     ',g.order.join(' → '),'min dist to known',g.mins.join(' '));
