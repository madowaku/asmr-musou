// Builds research/v06/summary.md from sound_features.json, sim.json, mix.json, perf.json.
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),R=f=>readFile(path.join(root,'research/v06',f),'utf8').then(JSON.parse);
const feat=await R('sound_features.json'),sim=await R('sim.json'),perf=await R('perf.json');
// mix.mjs may be run per stage in parallel (mix_s1.json …); merge whatever is there
const {readdir}=await import('node:fs/promises');const mix=[];for(const f of (await readdir(path.join(root,'research/v06'))).filter(f=>/^mix(_s\d)?\.json$/.test(f)).sort())mix.push(...await R(f));mix.sort((a,b)=>a.stage-b.stage||['slasher','crusher','caster'].indexOf(a.cls)-['slasher','crusher','caster'].indexOf(b.cls));
const JP={slasher:'大剣士',crusher:'拳闘士',caster:'魔法使い'},MJ=feat.jp,f1=x=>x==null?'—':x.toFixed(1),pc=x=>x==null?'—':(x*100).toFixed(0)+'%';
let md=`# v0.6 SOUND STAGES — AI による客観検証の集計（自動生成：tests/sound/summary.mjs）\n\n`;
md+=`## 1. 素材の音の違い（v0.3 合成音バンク、特徴量の距離。大きいほど違う）\n\n| | ${feat.materials.map(m=>MJ[m]).join(' | ')} |\n|---|${feat.materials.map(()=>'---:').join('|')}|\n`;
for(const a of feat.materials)md+=`| ${MJ[a]} | ${feat.materials.map(b=>a===b?'·':feat.distance[a][b].toFixed(1)).join(' | ')} |\n`;
md+=`\n依頼書の順で「新しい素材と、既に知っている素材の最小距離」：${feat.briefOrder.order.slice(1).map((m,i)=>MJ[m]+' '+feat.briefOrder.minDistToKnown[i]).join(' → ')}\n`;
md+=`\n## 2. v0.5 と比べて操作・破壊快感を損なっていないか（${sim.seeds.length}シード）\n\n| プレイヤー | キャラ | 版 | 一手あたり | 一手あたり 強化前→後 | 一手の最大 強化前→後 | ボス撃破 | ボス撃破時間 | 最初の撃破 |\n|---|---|---|---:|---:|---:|---:|---:|---:|\n`;
const V={intent:'人間らしい',random:'でたらめ'};
for(const o of sim.summary)md+=`| ${V[o.skill]} | ${JP[o.cls]} | ${o.ver==='v05'?'v0.5':'**v0.6 Stage '+o.stage+'**'} | ${f1(o.perAction)} | ${f1(o.lv0)} → ${f1(o.lv2)} | ${f1(o.best0)} → ${f1(o.best2)} | ${o.bossDown}/${o.runs} | ${o.bossDown?f1(o.bossSecs)+'秒':'—'} | ${f1(o.firstKill)}秒 |\n`;
md+=`\n## 3. 段階ごとに壊れた素材の割合（人間らしいプレイヤー、3キャラ合計）\n\n| ステージ | ソロ（0〜12秒） | 混ざり始め（12〜24秒） | 半々（24〜36秒） | ボス |\n|---|---|---|---|---|\n`;
for(const st of [1,2,3]){const g=sim.summary.filter(o=>o.ver==='v06'&&o.stage===st&&o.skill==='intent'),agg={};for(const o of g)for(const [ph,v] of Object.entries(o.phaseShare||{})){agg[ph]=agg[ph]||{};for(const [m,x] of Object.entries(v))agg[ph][m]=(agg[ph][m]||0)+x/g.length;}
  const cell=ph=>agg[ph]?Object.entries(agg[ph]).sort((a,b)=>b[1]-a[1]).map(([m,x])=>MJ[m]+' '+pc(x)).join('・'):'—';md+=`| Stage ${st} | ${cell('solo')} | ${cell('mix')} | ${cell('blend')} | ${cell('boss')} |\n`;}
md+=`\n## 4. 新しい素材の音は埋もれていないか（同じプレイを v0.5 のミックスと v0.6 のミックスでオフライン描画）\n\n明瞭度＝主役の素材のエネルギー ÷（ほかの素材＋キャラの効果音）の中央値（dB）。埋もれ＝主役が鳴っている50msのうち、ほかの音の方が大きい割合。音の割合＝その段階の全エネルギーに占める割合。\n\n| ステージ | キャラ | 段階 | 明瞭度 v0.5 → v0.6 | 埋もれ v0.5 → v0.6 | 主役の素材の割合 v0.5 → v0.6 | キャラの効果音の割合 v0.5 → v0.6 |\n|---|---|---|---:|---:|---:|---:|\n`;
const PJ={solo:'ソロ',mix:'混ざり始め',blend:'半々',boss:'ボス'};
for(const r of mix)for(const ph of ['solo','mix','blend','boss']){const a=r.v05[ph],b=r.v06[ph];if(!a||!a.windows)continue;md+=`| ${r.stage} | ${JP[r.cls]} | ${PJ[ph]} | ${a.clarityMedian} → **${b.clarityMedian}** | ${pc(a.buried)} → **${pc(b.buried)}** | ${pc(a.leadShare)} → ${pc(b.leadShare)} | ${pc(a.heroShare)} → ${pc(b.heroShare)} |\n`;}
md+=`\n## 5. 性能（PC の Chrome、CPU 4倍スロットル、上手いボット、音を実際に鳴らした状態）\n\n| 版 | キャラ | 場面 | フレーム p95 | 平均 | 最大 | 描画 p95 | 音の処理 p95（10.7ms ごと） | 同時発音の最大 |
|---|---|---|---:|---:|---:|---:|---:|---:|
`;
for(const p of perf)md+=`| ${p.stage?'v0.6 Stage '+p.stage:'v0.5'} | ${JP[p.cls]} | ${p.phase==='rush'?'雑魚（0〜14秒）':'ボス（10秒）'} | ${p.p95}ms | ${p.avg}ms | ${p.max}ms | ${p.drawP95}ms | ${p.audioCpuP95}ms | ${p.voicesMax} | ${p.dropped} |\n`;
await writeFile(path.join(root,'research/v06/summary.md'),md);console.log(md);
