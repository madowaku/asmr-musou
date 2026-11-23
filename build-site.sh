#!/bin/sh
# Copies only the files needed to run ASMR MUSOU (game / soundboard / lab / lab-audio) from a checkout of
# any branch into a publish directory. Missing files are skipped, so main (v0.1), feat/v0.2-tactile and
# research/v0.3-materials all build with the same script. Nothing else (docs, tasks, raw art, research logs,
# tests, tools, .git) is published. Usage: sh build-site.sh <checkout> <out>
set -e
SRC=${1:-.}; OUT=${2:-dist}
rm -rf "$OUT"; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
cd "$SRC"
for f in index.html style.css game.js audio.js sprites.js soundboard.html lab.html lab-audio.html combat.html spin.html feel.html stages.html crunch.html tempo.html flow.html; do if [ -f "$f" ]; then cp "$f" "$OUT/"; fi; done
if [ -d lab ]; then cp -R lab "$OUT/lab"; fi
if [ -d combat ]; then cp -R combat "$OUT/combat"; fi
if [ -d spin ]; then cp -R spin "$OUT/spin"; fi
if [ -d feel ]; then cp -R feel "$OUT/feel"; fi
if [ -d stages ]; then cp -R stages "$OUT/stages"; fi
if [ -d crunch ]; then cp -R crunch "$OUT/crunch"; fi
if [ -d tempo ]; then cp -R tempo "$OUT/tempo"; fi
if [ -d flow ]; then cp -R flow "$OUT/flow"; fi
if [ -d assets/art ]; then
  mkdir -p "$OUT/assets/art"
  for p in assets/art/*.png; do case "$p" in *contact_sheet*) ;; *) cp "$p" "$OUT/assets/art/";; esac; done
  if [ -d assets/art/fx ]; then mkdir -p "$OUT/assets/art/fx"; for p in assets/art/fx/*.png; do case "$p" in *fx_sheet*) ;; *) cp "$p" "$OUT/assets/art/fx/";; esac; done; fi
  if [ -f assets/art/alt/wax_2_alt.png ]; then mkdir -p "$OUT/assets/art/alt"; cp assets/art/alt/wax_2_alt.png "$OUT/assets/art/alt/"; fi
fi
# Test builds: keep them out of search engines.
printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"
printf '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n' > "$OUT/_headers"
# A tiny launcher listing what this build contains (handy on a phone).
{ printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASMR MUSOU builds</title><link rel="icon" href="data:,"><style>body{font:18px system-ui;background:#151626;color:#eee;padding:24px}a{display:block;margin:14px 0;padding:16px;border-radius:12px;background:#2a2647;color:#fff;text-decoration:none}</style><h1>ASMR無双 試遊</h1>';
  if [ -f "$OUT/flow.html" ]; then printf '<a href="flow.html">CRUNCH FLOW v0.8（途切れない行列・壊して強くなる・双剣士）</a>'; fi
  if [ -f "$OUT/tempo.html" ]; then printf '<a href="tempo.html">CRUNCH LINE TEMPO（v0.7 比較版：序盤から連打できる）</a>'; fi
  if [ -f "$OUT/crunch.html" ]; then printf '<a href="crunch.html">CRUNCH LINE（縦スクロール防衛・一つを味わい、全部を砕く）</a>'; fi
  if [ -f "$OUT/stages.html" ]; then printf '<a href="stages.html">SOUND STAGES（素材と音を覚えるステージ・ASMR図鑑）</a>'; fi
  if [ -f "$OUT/feel.html" ]; then printf '<a href="feel.html">FEEL LAB（触ったところが壊れる・60秒で成長）</a>'; fi
  if [ -f "$OUT/spin.html" ]; then printf '<a href="spin.html">SPIN LAB（前は破壊、背中は回収）</a>'; fi
  if [ -f "$OUT/combat.html" ]; then printf '<a href="combat.html">COMBAT LAB（3キャラ戦闘）</a>'; fi
  if [ -f "$OUT/index.html" ]; then printf '<a href="index.html">ゲーム（無双 / v0.2系）</a>'; fi
  if [ -f "$OUT/soundboard.html" ]; then printf '<a href="soundboard.html">ゲームの試聴室</a>'; fi
  if [ -f "$OUT/lab.html" ]; then printf '<a href="lab.html">ASMR素材研究所</a>'; fi
  if [ -f "$OUT/lab-audio.html" ]; then printf '<a href="lab-audio.html">素材音響ラボ</a>'; fi
} > "$OUT/play.html"
echo "built $(find "$OUT" -type f | wc -l) files -> $OUT"
