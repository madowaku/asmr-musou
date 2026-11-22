// Builds research/v05/summary.md from sim.json, compare.json, bench.json, input_perf.json.
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),R=f=>readFile(path.join(root,'research/v05',f),'utf8').then(JSON.parse);
const sim=await R('sim.json'),cmp=await R('compare.json'),bench=await R('bench.json'),inp=await R('input_perf.json');
const JP={slasher:'SLASHER 大剣士',crusher:'CRUSHER 拳闘士',caster:'CASTER 魔法使い'},V={random:'でたらめ',intent:'人間らしい','skilled':'上手い','intent-noup':'人間らしい・強化なし（対照）'};
const f1=x=>x==null||Number.isNaN(x)?'—':x.toFixed(1),f0=x=>x==null||Number.isNaN(x)?'—':x.toFixed(0),pc=x=>(x*100).toFixed(0)+'%';
let md=`# v0.5 FEEL LAB — AI による客観検証の集計（自動生成：tests/feel/summary.mjs）\n\n`;
md+=`## 1. 操作の前後比較（同じ「人間らしい」プレイヤー、4シード × 各キャラ）\n人間らしいプレイヤー＝群れの濃い所を見て、大剣士はそこをスワイプ、拳闘士・魔法使いはその敵をタップする（0.4秒ごと）。\n\n| キャラ | 版 | 狙った敵に当たった | 0.6秒以内に何も壊れなかった入力 | 無視された入力 | 一入力あたりの撃破 | 入力→最初の破壊（中央値） | ボス撃破 |\n|---|---|---:|---:|---:|---:|---:|---:|\n`;
for(const c of ['slasher','crusher','caster'])for(const v of ['v04','v05']){const o=cmp.summary.find(s=>s.key===v+' '+c);md+=`| ${JP[c]} | ${v==='v04'?'v0.4':'**v0.5**'} | ${pc(o.targetHit)} | ${pc(o.noBreak)} | ${pc(o.ignored)} | ${o.killsPerInput.toFixed(2)} | ${(o.latency*1000).toFixed(0)}ms | ${o.bossDown} |\n`;}
md+=`\n## 2. 60秒の通しプレイ（6シード × 3キャラ × 4条件 = 72試合）\n\n| キャラ | プレイヤー | 撃破 | 一手あたり | 一手あたり 強化前→強化後 | 一手の最大 強化前→強化後 | ボス撃破 | ボス撃破時間 | 最初の撃破 | 終了時刻 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const o of sim.summary)md+=`| ${JP[o.cls]} | ${V[o.variant]} | ${f0(o.kills)} | ${f1(o.perAction)} | ${o.variant==='intent-noup'?'（強化なし）':f1(o.lv0)+' → '+f1(o.lv2)} | ${o.variant==='intent-noup'?'—':f0(o.best0)+' → '+f0(o.best2)} | ${o.bossDown}/${o.runs} | ${o.bossDown?f1(o.bossSecs)+'秒':'—'} | ${f1(o.firstKill)}秒 | ${f1(o.seconds)}秒 |\n`;
md+=`\n「一手あたり 強化前→強化後」は、同じ試合の中で強化を選ぶ前と2つ選んだ後の雑魚戦の比較。強化のたびに群れも厚くなるので、両方の効果を含む。強化そのものの効果は §3 と、対照（強化なし）との比較で見る。\n`;
md+=`\n## 3. 強化前後の破壊規模（同じ群れ・一手・24試行の平均）\n\n| キャラ | 強化 | 人間らしい：撃破（群れの割合） | 上手い：撃破（群れの割合） | 破壊が続く時間（人間らしい） |\n|---|---|---:|---:|---:|\n`;
for(const c of ['slasher','crusher','caster'])for(const u of [...new Set(bench.filter(b=>b.cls===c).map(b=>b.ups))]){const a=bench.find(b=>b.cls===c&&b.ups===u&&b.skill==='intent'),s=bench.find(b=>b.cls===c&&b.ups===u&&b.skill==='skilled');md+=`| ${JP[c]} | ${u==='none'?'強化なし':u} | ${a.kills.toFixed(1)}（${pc(a.share)}） | ${s?s.kills.toFixed(1)+'（'+pc(s.share)+'）':'—'} | ${a.dur.toFixed(2)}秒 |\n`;}
md+=`\n## 4. 実際のポインター入力（Chrome、スマホの画面サイズ、実時間）\n\n| キャラ | 基本の操作 | 触った場所と攻撃の場所の距離 | 押してから発動 | 発動→最初の破壊・命中 | その一手の撃破 | 長押し→離す |\n|---|---|---:|---:|---:|---:|---|\n`;
for(const c of ['slasher','crusher','caster']){const r=inp[c];md+=`| ${JP[c]} | ${r.basic.kind} | ${r.basic.distToTarget}px | ${c==='slasher'?'スワイプの途中（52px 動いた時点）':r.basic.latencyMs.downToFire+'ms'} | ${r.basic.latencyMs.fireToBreak}ms | ${r.basic.kills} | ${r.hold.kind}：${r.hold.kills}体 |\n`;}
md+=`\n強化の画面：時間が止まる＝${inp.upgrade.timeStopped}、選んだ強化が反映される＝${inp.upgrade.applied}\n`;
md+=`\n## 5. 性能（PC の Chrome、CPU 4倍スロットル、上手いボットが14秒プレイ、描画あり）\n\n| キャラ | フレーム p95 | 平均 | 最大 | 更新 p95 | 描画 p95 |\n|---|---:|---:|---:|---:|---:|\n`;
for(const c of ['slasher','crusher','caster']){const p=inp.perf[c];md+=`| ${JP[c]} | ${p.p95}ms | ${p.avg}ms | ${p.max}ms | ${p.update.p95}ms | ${p.draw.p95}ms |\n`;}
await writeFile(path.join(root,'research/v05/summary.md'),md);console.log(md);
