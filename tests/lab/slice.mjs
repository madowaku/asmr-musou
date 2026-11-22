import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),S=require('../../lab/slice.js');
const polygon=xy=>xy.map(([x,y])=>({x,y,u:x/100,v:y/100,cut:null}));
const square=polygon([[0,0],[100,0],[100,100],[0,100]]);
const cShape=polygon([[0,0],[100,0],[100,20],[20,20],[20,80],[100,80],[100,100],[0,100]]);
const star=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?21:50,x=50+Math.cos(a)*r,y=50+Math.sin(a)*r;return {x,y,u:x/100,v:y/100};});
let cases=0,maxError=0;
function verify(source,result,expected){
  cases++;if(expected!==undefined)assert.equal(result.pieces.length,expected,'piece count');
  const total=[...result.pieces,...result.debris].reduce((n,p)=>n+S.area(p),0),error=Math.abs(total-S.area(source))/S.area(source);maxError=Math.max(error,maxError);assert(error<.005,'area conservation');
  for(const p of result.pieces){const ids=S.triangulate(p);let coverage=0;for(let i=0;i<ids.length;i+=3){const t=ids.slice(i,i+3).map(j=>p[j]);coverage+=S.area(t);assert(S.contains(p,S.centroid(t)),'triangle outside piece');}assert(Math.abs(coverage-S.area(p))<Math.max(1e-5,S.area(p)*.005),'triangulation coverage');for(const v of p){assert(Number.isFinite(v.u)&&Number.isFinite(v.v));assert(Math.abs(v.u-v.x/100)<1e-5);assert(Math.abs(v.v-v.y/100)<1e-5);}}
}
for(const [name,p,counts]of [['square',square,[2,2,2,2,1]],['C',cShape,[2,3,3,3,1]],['star',star,[2,2,2,2,2]]]){
  for(const [i,angle]of [0,37,90].entries()){const r=angle*Math.PI/180;verify(p,S.splitLine(p,{x:50,y:50},{x:50+Math.cos(r),y:50+Math.sin(r)}),counts[i]);}
  verify(p,S.splitLine(p,p[0],{x:50,y:50}),counts[3]);
  verify(p,S.splitLine(p,p[0],p[1]),counts[4]);
  console.log('Geometry:',name,'0 / 37 / 90 degrees, vertex, collinear edge');
}
verify(square,S.splitLine(square,{x:0,y:0},{x:100,y:100}),2);
verify(square,S.splitLine(square,{x:0,y:0},{x:100,y:0}),1);
verify(square,S.splitLine(square,{x:-1,y:1},{x:1,y:-1}),1); // tangent vertex
verify(square,S.splitPath(square,[{x:-10,y:50},{x:40,y:50}]),1); // knife stops inside
const bent=[{x:-20,y:25},{x:50,y:55},{x:120,y:25}];
const curved=S.splitPath(square,bent);verify(square,curved,2);assert(curved.pieces.some(p=>p.some(v=>Math.abs(v.x-50)<1e-5&&Math.abs(v.y-55)<1e-5&&v.cut)),'bend retained');
verify(square,S.splitPath(square,[{x:-20,y:25},{x:120,y:25},{x:120,y:75},{x:-20,y:75}]),3);
const sliver=S.splitLine(square,{x:0,y:.001},{x:100,y:.001},{minArea:.2});verify(square,sliver,1);assert.equal(sliver.debris.length,1);
const reversed=square.slice().reverse();verify(reversed,S.splitLine(reversed,{x:50,y:-1},{x:50,y:101}),2);
let body={poly:square,depth:0};
for(let d=0;d<3;d++){const center=S.centroid(body.poly),r=S.splitBody(body,[{x:center.x,y:-20},{x:center.x,y:120}]);assert(r.cut);body=r.pieces[0];assert.equal(body.depth,d+1);}
assert.equal(S.splitBody(body,[{x:-10,y:50},{x:110,y:50}]).cut,false);
assert(S.splitBody(body,[{x:-10,y:50},{x:110,y:50}],{maxDepth:4}).cut);
assert.equal(S.resample([{x:0,y:0},{x:25,y:25},{x:100,y:100}]).length,2);
// Reproducible concave radial fuzz. No invalid/self-intersecting inputs hidden by a catch.
let seed=188;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
for(let k=0;k<180;k++){const p=Array.from({length:18},(_,i)=>{const a=i/18*Math.PI*2,r=20+random()*30,x=50+Math.cos(a)*r,y=50+Math.sin(a)*r;return {x,y,u:x/100,v:y/100};}),angle=random()*Math.PI,a={x:20+random()*60,y:20+random()*60};verify(p,S.splitLine(p,a,{x:a.x+Math.cos(angle),y:a.y+Math.sin(angle)}));}
console.log(JSON.stringify({geometryCases:cases,maxRelativeAreaError:maxError,depthCap:3}));
