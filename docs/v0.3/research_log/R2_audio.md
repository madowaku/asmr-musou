# R2 — 素材と物理に結びつく合成ASMR音

2026-11-22 / research/v0.3-materials / Codex (Astra task)

**実装・数値ゲートは adopted。素材らしさ、気持ちよさ、耳疲れは全素材 needs ear-check。私は音を聴いていない。** 波形・スペクトログラム・ブラウザのPCM出力を調べた結果であり、人間の試聴・スマホの実機評価ではない。

正本 `docs/v0.3/DIRECTION_v0.3.md` に従い、8素材と大量破壊時の音を実装した。v0.2 `audio.js`、`tools/render-sfx.cjs`、`tools/analyze_sfx.py` を読み、固定150ms RMS、phone band、衝撃の立ち上がり、五音音階 `[0,2,4,7,9]` を継承。旧ファイルは変更していない。

## 成果物・再現コマンド

- `lab-audio.html`: file:// で開く単独音響実験ページ。素材の全22単発音、群れの余韻、連続イベントのスライダー、N/T群れ、1体比較、音量・無音化・CPU/voice表示。
- `lab/audio/dsp.js`: 23音種 × 3変種 = **69単発音**。8素材 × **16種類** = **128 micro-grains**。固定seedによる合成のみ。
- `lab/audio/engine.js`: 同じPCMエンジンをChromeとNodeの両方で使用。25ms先読み、40ms集約、連続音、ステレオ、フィルタ、最終リミッター。
- `lab/audio/audio.js`: 公開APIとイベント購読。`lab/audio/lab-page.js` は試聴ページ専用UI。
- `tools/lab-audio/`: 書き出し、指標、シナリオ、読みやすいスペクトログラム抜粋。
- `tests/lab-audio/`: Node + Playwright Chrome。package.jsonの編集なし。
- `research/v03/audio/`: **204 WAV**（69単発 + 128粒 + 7シナリオ）、数値JSON、測定表、試験記録、画面とスペクトログラム。

プロジェクトルートから、ネットワーク不要・既存ローカル依存で実行:

```powershell
node tools/lab-audio/render.cjs
node tests/lab-audio/run.mjs
python tools/analyze_sfx.py research/v03/audio research/v03/audio/_spectrograms.png
python tools/lab-audio/focus-sheet.py
```

`run.mjs` は render → Nodeの動作検査 → `chromium.launch({ channel: 'chrome', headless: true })` の順。Chromeはoffline、http(s)通信を遮断・記録。レンダラーはシナリオを別の簡易DSPに置き換えず、実際のEngineに時刻付きイベントを渡してPCMを処理する。WAVは48kHz PCM16、単発/粒はmono、シナリオはstereo。すべて `synth_` prefix。録音、外部音源、通信、ライブラリの追加なし。

## 最終測定値

`research/v03/audio/metrics.json` と `analysis.md` が全204件の詳細。シナリオのマスターは0.65。単発/粒のゲートはミックスバス前で測定。

| 対象 | 実測 | ゲート | 結果 |
|---|---:|---:|---|
| 単発69件のphone band最小値 | 93.31% | ≥50% | PASS |
| 単発の最大sample peak | −3.218 dBFS | ≤−3 dBFS | PASS |
| impact指定音の最遅1ms peak窓 | 4.50ms | ≤8ms | PASS |
| RMS150 | 各指定値±0.001dB未満 | ±0.5dB | PASS |
| 粒128件のphone band最小値 | 78.99% | ≥50% | PASS |
| 粒の最大sample peak | −11.40 dBFS | ≤−3 dBFS | PASS |
| 40体 / 単体、400ms K-weighted差 | +3.065dB | ≤+8dB | PASS |
| 同比較、400ms RMS差 | +3.597dB | ≤+8dB | PASS |
| 40体の9kHz超電力 | 0.0432% | ≤3% | PASS |
| 砂flowの最大gap | 0ms | ≤30ms | PASS |
| 連続音4種、明示停止/更新途絶後50msの振幅 | 全て <1.4×10⁻⁸ | <0.0001 | PASS |
| 強制過入力のリミッターpeak | −2.15 dBFS | ≤−1dBFS | PASS |

| シナリオ | peak dBFS | max 400ms LUFS | >9k電力 % | 最大voice数 |
|---|---:|---:|---:|---:|
| single_kill（wax） | −12.55 | −29.98 | 0.0090 | 1 |
| horde_40_in_200ms | −11.22 | −26.91 | 0.0432 | 22 |
| horde_20_in_100ms | −11.15 | −26.77 | 0.0419 | 21 |
| sand_flow_3s_ramp | −22.25 | −29.16 | 0.0835 | 15 |
| wax_crack_grow_0.12s | −24.80 | −39.08 | 0.0001 | 7 |
| kohaku_cut | −13.61 | −30.78 | 0.0056 | 1 |
| soap_cut_then_30_cubes | −18.01 | −27.08 | 0.0061 | 11 |

全シナリオは非無音、最大sampleは−1dBFS以下。400ms値は48kHz BS.1770 K-weightフィルターを通した左右電力和、固定400msの最大sliding窓、ゲーティングなし。RMS400も同時検査する。短い単体を150msと群れを400msで比較する、といった窓の混同はない。これはsample peak検査で、inter-sample true peakや音圧測定ではない。

砂のgap判定は5ms電力窓、−65dBFS未満をgapとする。正の流量がある全3秒を検査する。流量5でも別検査で30msを超えるgapなし。スペクトログラムの共通横幅は旧analyzerの1.6秒表示仕様で、3.5秒の砂ファイルはその幅に圧縮表示されるため、gapは画像だけで判定していない。

RMS150 target: cut/snap主音 −23、wax snap/kohaku crust/inner/sponge press −27、crumble/stretch −28、peel/blip/clack −29、settle/drip/plink −31、release −33、dust −38、grain −37dBFS。短い音も固定150msの分母。impact指定はwax cut/peel/snap、jelly cut、soap clack、sand cut、sponge cut、chalk snap、beadslime cut/plink、kohaku cut/crust。擦過、流れ、圧搾、粉、伸張、余韻は持続音なので8msゲートの対象外。

単一素材だけ40体の追加検査では、同素材の単体に対して +2.23〜+4.91dB、9kHz超電力の最大0.356%。素材ミックスだけの偶然の合格に依存しない。

## 試した手法と採否

| 試行 | 観測・変更 | 判定 |
|---|---|---|
| A: 素材別ノイズ/共鳴/湿った粒 + RMS150 + onset制御 | 初回から204件のレンダーゲートPASS。40体は単体比+3.080dB、9kHz超0.04%、砂gap0ms。しかし低→高へ変わる0.12秒の亀裂は最初の1粒しか出ず、シナリオ400ms値−48.94 LUFS。ゲートだけではパラメータ追従の不具合を発見できなかった。 | 波形構成はadopted、固定された次粒時刻はrejected |
| B: 亀裂の発音予約を現在rateに合わせ再計算 | 0.12秒の亀裂が11粒、−39.08 LUFSへ。400msの一定rate比較で10 cells/s=4粒、160 cells/s=58粒。明示zero/更新途絶どちらでも停止。 | adopted |
| C: 余剰killの素材だけからmassを作る | 最初の3体と8素材の周期が固定窓に一致し、massに5/8素材しか残らない。Nodeの実際のイベント履歴検査でFAIL（5 != 8）。 | rejected |
| D: massの量は余剰数、素材分布は窓内全killを使用 | 8/8素材の粒がmassに含まれる。最終40体は+3.065dB、22集約/18個別、6窓、48mass粒、余韻1回。量を8粒固定の雲のgain √Nに変換し密度duckを併用。 | adopted |
| E: 長い石鹸cutの単純バッファ折り返し | コード確認で、末尾fadeから途中へ戻る不連続を発見。聴感でのクリックは未確認。 | rejected |
| F: 石鹸cutの8ms equal-power overlap | noiseの中間部分をoverlapし、長さを length/speed（55〜650ms）で設定。300px/sと1800px/sで実際のvoice継続時間が4倍超変わる。規則的な素材周期が聴こえるかは未確認。 | 実装adopted、質感needs ear-check |
| G: horde countを余韻の成立条件にも使う | 将来の予定数だけで、実際の撃破が少ないのに余韻が出る可能性をコード確認で発見。 | rejected |
| H: 実際のkill≥15のみ余韻。horde count/spanは期限付きの音色予告 | 1kill+40予定の入力で余韻0回を検査。40killでは85msの静けさ後に0.6秒の余韻1回。 | adopted |
| I: classic-script PCMバックエンド | ScriptProcessor 512で共有DSPを直接出力。Chromeの実出力に非無音を確認し、mute後0。通常horde p95 0.50ms、4倍CPU・flow+horde p95 1.30ms（audio callback単体）。 | ローカル試作としてadopted、実機/統合負荷needs ear-check/device-check |
| J: 図の抜粋スクリプト名 inspect.py | Python標準inspectを隠し、Pillow importが循環して失敗。`focus-sheet.py` に改名し再実行成功。 | 旧名rejected、改名adopted |

`research/v03/audio/attempt-02-render.txt` はB/F後・C修正前の数値記録。`test-output.txt` と `metrics.json` が最終値。ライブのkill窓は開始時刻・ブラウザのタイマーの丸めにより分割数が変わる。記録したChrome試験では24集約/16個別、最大23 voices、余韻1。オフラインの18/22との違いは固定窓境界によるもので、kill総数40は一致する。

## 合成・ミキサーの構成

- wax: 2.2〜5.9kHzの短い不規則共鳴を亀裂にし、peelは乾いたtick、cutは8ms後からwetな芯を足す。
- jelly: 700〜2.3kHz中心の下降する気泡/帯域ノイズ。wobbleは中域blipの振幅を物理freqで変調。出力包絡の2Hz/8Hz成分が入力に従うことをNodeで検査。
- soap: 1.1〜3.8kHzノイズのscrape。立方体は1.1/2.3kHzの短いknock、crumbleは粒の集まり。長いcutは上記overlap。
- sand: 3.2〜6.9kHzのsoft grain、48ms窓を重ねる。flowは毎秒45〜195粒、流量を平方根で圧縮してgain/densityを増やす。正の小流量でも途切れないため最小重なりを確保する（粒子1個=音1個ではない）。
- sponge: 1.7〜5.4kHzのfizz + 中域wet/drip。press開始時の水を含む層と圧力連動の粒、cutは多孔質のノイズ。
- chalk: 1.85/3.4kHzの短いsnap、乾いたノイズのcrumble、−38dBFSのdust。
- beadslime: 580Hz以上の湿った層と遅い脈動、3〜5kHzの短いplink。peelでstretch、impact/crumbleでbead release。
- kohaku: 3.3〜6.7kHzのcrystalを最初に置き、12ms後からwetな芯を重ねる。crust/innerを別ボタンで比較可能。

素材ごと16粒は波形hashで全て別物、同seedは再現可能。共通プリミティブは使うが、全素材に同じ打音を上乗せしてゲートを満たす方式ではない。生波形にはDC除去、edge fade、500Hz近辺の整理、RMS150正規化、−3.2dBFSの飽和天井を入れる。

Engineは5ms刻みの制御、25ms先の粒を予約。各streamは名前+素材で共有し、入力が32ms途切れれば10msでfade。zeroなら即座に未来の予約を破棄し、再生中を10msでfade。制御値には平滑化、粒にはfade、masterには12ms平滑化がある。`wobble/flow/crack_grow/press` の自動停止はNodeで実波形を検査。Chrome明示停止の今回のPCM callback tailは4ms、別途callback buffer 10.67msと報告baseLatency 10msがある。物理スピーカーまでの遅延は測定していない。

40ms窓の最初の3killは音階を適用。stroke識別子は契約にないため、120ms以上のkill間隔で音階をリセットする。massは固定8粒に余剰数の√N gainを与え、直近200ms密度に応じてduckする。高域シェルフは3.6kHzから最大−8dB、spreadは±0.12〜0.4。xを含めpanは必ず±0.4以内。主バスは180Hz HP、シェルフ、7.2kHz LP×2、master、左右連動リミッター+有界soft knee。

voice capは予約中を含め24。cap時は新しい発音を省略し、鳴っている音を突然切らない。単独の基準40体では省略0、砂だけ40体では追加detail2件省略。4倍CPU試験のflow+horde同時負荷では29件省略。`dropped`、`started`、`massGrains`（予約試行数）で観測可能。混雑時に全ての微細音が聞こえるという保証はしない。

## エンジン統合契約

イベントemitterは既存の `LAB.events` をそのまま使う。存在しない場合のみ小さな互換emitterを生成。既存emitterの同一性・購読機能もChromeで検証した。

`lab.html` へ統合する担当者は `lab/events.js` の後に次をclassic scriptで読み込む。**既存の仮クリック用 `lab/audio.js` は読み込まない。** `lab/audio/lab-page.js` は単独音響ページ専用で、ゲームへ入れない。

```html
<script src="lab/audio/dsp.js"></script>
<script src="lab/audio/engine.js"></script>
<script src="lab/audio/audio.js"></script>
```

```js
// 操作開始のユーザージェスチャー内で呼ぶ。Promise<boolean>。
await LAB.audio.init();
LAB.audio.setEnabled(true);
LAB.audio.setMaster(0.65); // 0..1
LAB.audio.stats();

LAB.events.emit('cut', { material: 'soap', speed: 600, length: 180,
  area: 3000, depth: 1, x: 360, y: 500, kills: 0 });
LAB.events.emit('flow', { material: 'sand', rate: 800, x: 360 });
LAB.events.emit('flow', { material: 'sand', rate: 0, x: 360 });
LAB.events.emit('kill', { material: 'kohaku', x: 420, y: 600 });
```

**良い追従のために出してほしい値:**

| イベント | 値・頻度・意味 |
|---|---|
| cut | 実測speed px/s、切断length px、area px²。soap durationはlength/speed。depthは強度に使い1で飽和。killsはcutの音量を抑える参考数で、kill数に加算しない。1素材35ms内の重複cutを間引く。 |
| crack_grow | 生きた亀裂のrate cells/sを毎フレーム。終了でrate:0。 |
| peel | 剥がれた時に1回。sizeは相対サイズ、未指定1、gain上限あり。beadslimeでは伸張に対応。 |
| wobble | freq Hz（0.5〜18）、amp 0..1を毎フレーム。止まったらamp:0またはfreq:0。 |
| flow | rate particles/sを毎フレーム。実用調整域0〜1200。終了で必ずrate:0。 |
| impact | energyは相対0..1推奨、未指定0.5。素材片/ビーズの接触。1素材12ms以内の重複は間引く。 |
| press | pressure 0..1を押している間毎フレーム。離したら0。sponge=水、beadslime=粘り。 |
| crumble | countの粒量を最大10音へ畳み込む。chalkはdustも付加。 |
| kill | 実際の撃破につき1回。cutと併用可。cut.killsだけで撃破を表現せず必ずkillを出す。 |
| horde | 任意のcount/span_msは音色の密度予告。通常はstroke直前。killを追加生成しないし、余韻の成立数も増やさない。これ単独では鳴らない。 |

素材IDは `wax jelly soap sand sponge chalk beadslime kohaku`。未知materialは無視。未指定の任意値は安全な既定値、非有限値はfallback、負値はclamp。

**座標:** 現行labは720×1280のworld座標なのでxはそのまま渡す。0=左−0.4、360=中央、720=右+0.4、未指定=中央。別world幅ならinit前に `LAB.audioWorldWidth = width`。正規化xならwidth=1。ブラウザCSSのviewport幅に暗黙変換しない。yは音に影響させない。

**連続イベント:** 60Hz程度で送る。32ms leaseは短い停止反応のためで、30fps以下や重いフレームでは途切れうる。終了時zeroを推奨。複数の同素材から出す場合、今の契約にはsource IDがないため、engine側で流量/亀裂rateを集計し、wobbleは代表freqとampを1件/素材にまとめると良い。別々の物体の独立した停止はこのAPIだけでは識別できない。

## 既存文書・並行コードとの食い違い

1. `docs/v0.3/MATERIAL_RESEARCH_PLAN.md` 冒頭の「計画のみ、v0.2の試遊後」、§2の4素材、§6の未決事項は、より新しい正本 `DIRECTION_v0.3.md` の8素材・決定済み方針と異なる。正本と今回の明示依頼を採用し、古い計画書は変更していない。
2. 並行作業で現れた `lab/audio.js` は仮クリック、APIは `unlock()/toggle()/ready`。`lab/main.js` のpointer downとsound buttonがそれを呼んでいる。本R2は依頼の `init()/setEnabled()/setMaster()/stats()` を採用。担当外のファイルは変更せず、ゲーム本体への差し替えはR0統合待ち。単独 `lab-audio.html` は接続済み。
3. xの単位は依頼で明示されていない一方、`lab/main.js` のpoint変換・cutイベントは720幅worldのpx。既存コードに合わせて720を既定とし、world幅を設定可能にした。独断で既存の座標系を変更していない。

## 視覚検査と未確認の制約

必須analyzerを実行し、`_spectrograms.png` と原行を抜粋した `_focus_spectrograms.png` を実際に開いて確認した。kohaku cutは先頭の短い高域群と、その後の低めの中域に分かれる。砂flowは滑らかな帯、石鹸のcubeは短い独立した縦縞、wax crackは後半ほど粒が密。極端な低音だけの素材や、全シナリオに広がる9kHz超の明るい帯は見られない。ただし形が違うことから素材として聞き分けられるとは結論しない。

`lab-audio-desktop.png` / `lab-audio-mobile.png` も目視。390px画面で横overflowなし、縦スクロールで全操作に到達。Chrome console error 0、ネットワーク0。JSON中のChrome版は158.0.8127.36。

classic scripts/file:///同一DSPという制約を優先し、今回はScriptProcessorを使う。これは旧APIでmain threadに依存する。AudioWorkletのmodule/blob配布やnativeノードとの二重DSPは実装していない。Chromeの動作確認は済んだが、WebGL描画と同時の本編負荷・Android/iOS・Bluetooth・長時間の耳疲れは未検証。初回bank生成は今回約432msで、一度だけ同期的に処理される。4倍CPUの1.30msは**音声callback単体**の値で、本編フレームp95<8msを証明しない。

## 弱いと予想する音・人間のear-check script

最も弱いと予想するのは**粒入りスライムの伸張**と**スポンジの水分感**。前者はjellyとwetプリミティブを共有し、粘弾性の「糸を引く」実在感が足りない可能性がある。後者はfizzが主体で、空気と水の比率がchalk/sandのノイズに近く聞こえる可能性がある。琥珀糖は硬/柔の時間・帯域差はあるが、殻がガラス質/金属質に聞こえたり、wetな芯がwaxと似たりする可能性が次点。waxの短い亀裂は−39 LUFSで意図的に控えめなためスマホでは消えすぎるかもしれない。

試聴は `lab-audio.html` を開き、masterをまず20〜30%程度にして「音を開始」。適切な音量を決めたら素材間・単体/群れで動かさない。スマホスピーカーと普段のイヤホンで別々に記録する。

| 素材 | 操作 | 聴いてほしいこと | 状態 |
|---|---|---|---|
| wax | cut→peel→snap。亀裂slider 20→160→0。 | 硬い殻の直後に柔らかな芯が残るか。亀裂の粒数が増えるか。細かいtickが痛くないか。 | needs ear-check |
| jelly | cut→blip。揺れ50%、freq 2→8Hz→amp 0。 | ぷちゅと水の揺れに聞こえるか。唸り/ゲーム機の電子音になっていないか。 | needs ear-check |
| soap | cut→clack→crumble、soap_cut_then_30_cubes WAV。 | 切削が滑らかか。cubeが木琴や金属に聞こえないか。長いscrapeに不自然な周期がないか。 | needs ear-check |
| sand | cut。flow 5→300→1200→0。 | ザッとサラサラが別の動作に聞こえるか。音量が飛ばず、穴/ジッというzipperがないか。 | needs ear-check |
| sponge | cut→press→drip。pressure 20→90→0%。 | 乾いたスポンジではなく水を含むか。泡と水滴が別々に感じられるか。 | needs ear-check |
| chalk | snap→crumble→dust。 | 短いポキッが尖りすぎないか。砂とは違う乾いた粉か。dustが主役を邪魔しないか。 | needs ear-check |
| beadslime | cut→stretch→plink、素材を固定して群れ。 | 粘りがjellyより遅い/重いか。plinkがベルの演奏になっていないか。 | needs ear-check |
| kohaku | crust→inner→cutを交互。 | 1回のcutで「薄い硬い殻→柔らかな芯」の両方を聞き取れるか。単なるwax/ガラス音との差。 | needs ear-check |

最後に「同じ音量で1体」→20体/100ms→40体/200ms。同じmasterで数回ずつ、ミックスと各素材を比較。40体が大音量だけで迫力を作っていないか、後半が耳に刺さらないか、定位が飛ばないか、15体以上の余韻が勝利ジングルではなく解放感になっているかを記録。何回なら気持ちよく繰り返せるかも記録する。**この欄の人間による結果はまだない。**

## R2b

2026-11-22 / Codex task R2b (Astra)。正本は `docs/v0.3/ASMR_TEMPORAL_STRUCTURE.md`。以下はR2の記録への追記で、以前の採否・数値は当時の結果として残す。

**実装・数値・視覚検査は通過。音を聴いたという主張はしない。洪水／雪崩に聞こえるか、素材らしさ、快適さと耳疲れは全素材 needs human ear-check。** 本編の描画・物理統合と実機確認は今回の所有範囲外。

### R2から変えたこと

- `lab/profiles.js`: pure dataの9素材。waxの別名squeeze、bubbleを追加。pre/postは正本の秒数。正本が数値を定めないsponge/beadslimeのpre、bubbleの短いpostはmin/max=null。操作依存・未指定を明示し、正本にない秒数を確定仕様にしない。collapse.base/logGrowthは音響用の調整値。
- `lab/audio/temporal.js`: 位置順の波プラン、5段階の破断形状、素材別アクセント／崩落、継ぎ目のない予兆。単発はフル、連打は90ms以内へ短縮＋五音音階、rushは先頭3体だけフル、残り25ms粒、avalancheは18ms、floodは12ms粒＋8ms間隔の重なった素材層。
- 20/40では最後の破断位置に160msの素材アクセント。waxはwet shell-burst、soapはcrumble-hit、砂はslide、chalkは粉の崩落、kohakuはcrystal burst、jellyはwet slap、spongeはwater squeeze、beadslimeはbead spill、bubbleはcluster pop。
- 崩落時間は素材のbase + logGrowth × log2(N)。ロウはshell-chip rain、石鹸はcube、砂は連続流、chalkはdust、kohakuはcrystal、jellyはwet slap、beadslimeはbead patter、spongeはdrip。混合時、個々の破断は元の素材を保ち、崩落・アクセントは最多素材。同数なら波の先頭側を優先。
- R2の固定8粒×√Nは新waveの主経路で使わない。長さ・発音密度・音色・幅・末尾を増やし、全イベント共通のN^-0.22で音量予算を配る。ファイルごとの事後正規化なし。旧kill/horde経路は比較・互換用として残す。
- `lab-audio.html`: 9素材の時間バーとstrain slider／解放ボタン、新wave material/N panel、同じdtを使う左→右の視覚シミュレーション。R2の群れは比較用と表示。

### 試行・採否

| 試行 | 観測と変更 | 判定 |
|---|---|---|
| A: 全段階を破断→粒→連続層へmorph、素材アクセントとlog尾 | 初回1→40差がwax +13.19、soap +12.29、sand +9.34、kohaku +13.23dB。質感は変わるが予算超過。 | 形状採用、未制御gainは却下 |
| B: 波全体共通のN^-0.22予算 | 個々の破断、accent、tailの相対ダイナミクスを保持し、最終差+2.32〜+6.33dB。全9素材endpoint補助検査も+2〜8dB内。 | 採用 |
| C: onset検出の直前6ms最小電力基準 | ノイズの谷を過剰に拾う。生の粒子数とも混同できない。直前6ms平均基準へ変更し、全素材で同一条件に固定。 | 最小値基準を却下、平均基準採用 |
| D: 均等な崩落間隔 | 最初のwave_ladderを開くと石鹸の尾が規則的な櫛に見えた。間隔にseed固定のばらつき＋減速を加え、再レンダー・再目視。 | 均等配置を却下、ばらつき採用 |
| E: soap予兆を極端に小さく | 低amountの5ms窓が-90dBFSを下回る区間が10ms。ほぼ無音という役割を保ちつつ摩擦の連続床を微増。 | 調整後採用 |
| F: strainの粒の次回時刻を低amountのまま保持 | amountを急上昇させた50ms内の出力が、soapで安定後の25%に満たずNode検査FAIL。次回時刻を現在の張力に追従させた。 | 旧予約方式を却下、追従方式採用 |
| G: 波を全て予約voiceとして追加 | R2の24voice capを先々の音で埋めないよう、別queueから25ms先までだけdispatch。 | 採用、指定16波でdrop 0、最大15voice |

### 最終ラダー測定

書き出した48kHz stereo PCM16そのものを測定。master=.65。durationは2ms RMS包絡の最大値に対する-40dBまで。onsetは2ms窓・1ms hop、直前6ms平均より+4dB、7ms refractory、最大包絡比-35dB floorの音響検出。**1体でも破断内部と破片の複数onsetがあり、撃破数そのものではない。** centroidは電力重み付き。400ms値はR2と同じ最大K-weighted stereo energy。peakはsample peakでありtrue peakではない。tail欄は最後の破断＋accent区間終了から-40dB終端まで。

| material | N | -40dB s | onsets | /s | centroid Hz | 400ms LUFS | peak dBFS | >9k % | tail s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| wax | 1 | 0.561 | 19 | 33.9 | 2906 | -29.75 | -12.63 | 0.008 | 0.331 |
| wax | 3 | 0.899 | 56 | 62.3 | 3274 | -28.00 | -12.26 | 0.006 | 0.749 |
| wax | 10 | 1.383 | 103 | 74.5 | 3072 | -26.35 | -12.17 | 0.002 | 1.102 |
| wax | 20 | 1.729 | 122 | 70.6 | 3303 | -24.09 | -11.40 | 0.002 | 1.273 |
| wax | 40 | 2.066 | 167 | 80.8 | 3236 | -23.47 | -12.87 | 0.001 | 1.456 |
| soap | 1 | 0.501 | 15 | 29.9 | 2618 | -30.02 | -17.79 | 0.008 | 0.271 |
| soap | 3 | 0.849 | 19 | 22.4 | 2769 | -29.09 | -17.41 | 0.020 | 0.699 |
| soap | 10 | 1.349 | 45 | 33.4 | 1753 | -27.67 | -14.09 | 0.002 | 1.068 |
| soap | 20 | 1.699 | 69 | 40.6 | 1526 | -25.05 | -8.41 | 0.001 | 1.243 |
| soap | 40 | 2.046 | 110 | 53.8 | 1441 | -24.64 | -9.77 | 0.000 | 1.436 |
| sand | 1 | 1.866 | 5 | 2.7 | 4079 | -30.46 | -15.57 | 0.056 | 1.636 |
| sand | 10 | 2.845 | 14 | 4.9 | 4076 | -29.17 | -20.01 | 0.070 | 2.564 |
| sand | 40 | 3.619 | 24 | 6.6 | 4014 | -28.13 | -19.51 | 0.063 | 3.009 |
| kohaku | 1 | 0.610 | 9 | 14.8 | 3473 | -30.44 | -13.32 | 0.005 | 0.380 |
| kohaku | 10 | 1.437 | 84 | 58.5 | 4432 | -28.00 | -13.19 | 0.005 | 1.156 |
| kohaku | 40 | 2.115 | 144 | 68.1 | 4179 | -24.11 | -12.73 | 0.003 | 1.505 |

- Gate (a): 素材ごとのdurationとtransient countが指定Nに従い厳密増加。onset density自体の単調増加は条件に含めず、wax 10→20やsoap 1→3で低下する点も公開する。波そのもののkill密度は増え、全体密度には長い崩落時間が影響する。
- Gate (b): wax +6.28、soap +5.38、sand +2.32、kohaku +6.33dB。追加の全9素材endpoint検査の最大はbeadslime +7.72dB。
- Gate (c)(d): ラダー最大peak -8.41dBFS、>9kHz最大0.070%。全行phone bandも50%以上。
- Gate (e): 20/40はwave section末尾40%内に20ms平滑局所電力最大（全体最大の60%以上）あり。波の区間は最終dt+160ms。区間終了後の実測tailは最短1.243sで400ms以上。アクセントのイベント有無だけで合格にしていない。
- Gate (f): 9素材のstrain WAVは正amount保持中の5ms gap 0（-90dBFS床）。30/60fpsでamount .2→.85の最初50ms内に実PCM電力が最低+13.87dB増加、安定後電力比最低0.647。明示zeroから50ms後のpeakは全素材<1e-5。持続入力が消えた場合のみ70ms lease＋短いfadeで停止。これは明示zeroの50ms応答とは別。
- Chrome file://で9profile/9slider、解放→settle、1/3/10/20/40のwave、実PCM非無音、mute/stop、390px横overflowなし、console error 0、network 0。4倍CPUでbeadslime strain＋40体mix waveもcallback p95約1.4ms。描画・物理を加えた本編負荷の証明ではない。

再現:

```powershell
node tests/lab-audio/run.mjs
python tools/lab-audio/wave-figure.py
```

R2の253 WAV（追加bubble/accents込み）＋16 wave WAV＋9 strain WAV = 計278 WAV。新規音も全てoriginal procedural synthesis。録音・外部サンプル・依存追加なし。package.json変更なし。詳細は `wave-metrics.json`、`wave-analysis.md`、`temporal-tests.json`、`browser-tests.json`、`R2b-test-output.txt`。

### 視覚検査

`research/v03/audio/wave_ladder.png` を修正前・修正後とも実際に開いた。各素材5段を共通0〜2.4秒、共通波形±.30、共通STFT -85〜-25dBFSで比較し、行ごとの拡大・正規化をしていない。waxは単発の短い多帯域破断→rushの断続的な縦帯→floodの密な帯と殻片の雨。soapは広い擦過帯→短い粒の反復→低めの連続粒層・最後の広帯域accent・立方体の尾。長さだけでなく帯域と縦縞の密度が変わることを確認。微細な尾の周期性は残り得るので人間の耳で判断する。

desktop/mobile全体図と新panelのmobile抜粋を保存。正本で秒数未指定のpreは点線、短いsoap preと長いsand postの比率が画面で分かる。スマホ画面では1列となり全操作へスクロールできる。

### エンジン統合契約（R2b時点の正しい読み込み順）

```html
<!-- ホストのLAB.eventsの後。lab/audio.js（旧仮クリック）は併用しない -->
<script src="lab/profiles.js"></script>
<script src="lab/audio/dsp.js"></script>
<script src="lab/audio/temporal.js"></script>
<script src="lab/audio/engine.js"></script>
<script src="lab/audio/audio.js"></script>
```

`lab/audio/lab-page.js` と `temporal-page.js` は単独試聴UI専用。本編では読み込まない。initはユーザージェスチャー内。profilesとplanWaveは音声init前にも利用可能。

```js
await LAB.audio.init();
LAB.audio.setMaster(0.65);

// pre: 毎フレーム、同素材はホストで集約。rateは相対変形速度（標準1）。
LAB.events.emit('strain', {material: 'wax', amount: 0.6, rate: 1, x: 360});
// 明示停止。amount 0..1、rate 0..3（安定した最小密度あり）。
LAB.events.emit('strain', {material: 'wax', amount: 0, rate: 0});

// 単体release: strain停止＋既存フル解放音。cutの既存契約も残る。
LAB.events.emit('release', {material: 'wax', x: 360});
// post: 物理が落ち着き始めた時に1回。毎フレームではない。
LAB.events.emit('settle', {material: 'wax', energy: 0.8, x: 360});
// 既存flow/impact/crumble/wobbleを実物理に合わせて使うことも可能。

const swipe = {from: {x: 0, y: 640}, to: {x: 720, y: 640}};
const planned = LAB.audio.planWave(kills, swipe);
// kills: [{id?, material, x, y, ...}]。返り値は新しい位置順の配列。
// planned[i].dt: ミリ秒。入力オブジェクトを変更せず、id等も保持。
// 描画担当: 各破断をこのdtと同じオフセットで予約する。
const audioStart = LAB.audio.stats().time; // PCMエンジンの秒時計
LAB.events.emit('wave', {kills: planned, dir: 1});
// 視覚検証例:
// elapsedMs = (LAB.audio.stats().time - audioStart) * 1000;
// elapsedMs >= planned[i].dt になった物体の破断を描画する。
```

- planWaveのswipeはfrom/toの直線。位置を進行方向へ射影して順序とdtを求める。全点同じ射影位置なら入力順に均等配分。single=0、N3=60、N10≈191.43、N20≈295.83、N40=450ms。曲線の弧長はこのAPIに含まれない。
- waveは受け取ったdtを音響的に再配置しない。素材有効な先頭200件まで、dtは0〜5000msへ制限、非有限dtは0。未知素材は無視。world x/y単位はホストと同じ。dirは1/-1または{x,y}で、ステレオの進行方向に使用し、時間順を再計算しない。未指定は1。
- waveには素材release・末尾accent・collapseが全て含まれる。同じ撃破についてkill/horde/cut/settleを重複発行しない。残っているstrainはホストがamount:0で止める。個別releaseはstrain停止を兼ねるが、cutは既存動作を保つ。
- mixedのmaterialはkillごとに保持。最多素材はcanonical IDで数え、squeezeはwax。全9素材ID: wax/bubble/jelly/soap/sand/chalk/sponge/beadslime/kohaku。
- `LAB.profiles.tier(n)` はsingle/combo/rush/avalanche/flood。`LAB.profiles.tiers` のwaveMin/Maxはms、素材pre/post/collapseは秒。
- strainは同素材1stream、毎フレーム更新、amount0で終了。32msの旧stream leaseと別に70ms leaseで30fpsもカバー。入力変化の音響追従と、ブラウザーcallback/デバイス/BT遅延は別。視覚シミュレーションはPCM時計に追従するが、スピーカー到達時刻を測定していない。
- 24voice cap、4096件pending cap。今回の指定ラダー・9素材mixはdrop0。多数の波の同時再生や同じdtへの極端な集中では詳細音を省略し得る。`stats().dropped/queued/lastWave/strains` で観測する。200体超や過負荷を無制限に鳴らすAPIではない。

### 弱点と人間のear-check script

一番弱い可能性は**石鹸floodの粒が硬いクリック／小さな木琴に聞こえること**、次に**ロウのwet accentが「バシャッ」に足りないこと**。石鹸のcentroidが2618→1441Hzへ下がるため、丸いclackの連打になっていないかを重点確認。waxの19→167 onsetsは聴感上の豊かさの証明ではない。beadslimeの張力とspongeの水分感も旧R2同様に要試聴。砂の1→40差は+2.32dBと下限に近く、長い尾に頼る規模感。ScriptProcessorのmain-thread依存、初回bank同期生成（今回Chrome約595ms）、同時多波のcapも残る。

試聴手順（音量を固定して、スマホスピーカーと普段のイヤホンを別々に）:

1. `lab-audio.html` のmasterを20〜30%から開始して適切な音量に固定。wave panelでwax、Nを1→3→10→20→40。各回は余韻が終わるまで待つ。
2. wax: 1「パキッ＋殻片」→3「パキパキッ」→10「バリバリバリッ」→20「バリバリバシャッ！」→40「殻の割れる洪水が流れ、殻片の雨へ」。20/40の終端が単なる強いクリックになっていないか。
3. soap: 1「サクッ」→3「サクサクッ」→10「ザクザクザクッ」→20「ザザザザッ！」→40「粒が崩れる雪崩」。20→40が同じ音を長くしただけか、独立粒が連続する質感に変わったか。
4. N40→1へ戻し、音量以外に長さ・密度・広がり・末尾の違いが残るか。sandとkohakuも1→10→40、次に9素材mixで素材が消えていないか。
5. 予兆sliderを20→60→90%、2秒保持→「解放」。waxは細い亀裂が育つ、spongeはじゅわ、beadslimeは張りが上がる、sandはこぼれ始める、chalkは微かなきしみ、kohakuは外皮tick、jellyは柔らかいへこみ、soapはほぼ無音。0へ戻す操作も試し、音切れ・笛のような唸り・zipperがないか。
6. 特にN20/40を各5回ずつ繰り返し、「刺さり」「単調さ」「もう一度触りたい」「音量を下げたくなる」を記録。**まだ人間による採用判断はない。**

### 文書・並行コードとの食い違い

1. 本ファイルR2「合成・ミキサーの構成」「エンジン統合契約」の8素材／固定8grainの√N主経路／旧3script読み込みはR2当時の記録。R2bは今回の依頼と新しい時間構造正本に従って9素材＋wave主経路＋profiles/temporal追加を採用。この追記を最新契約とし、旧章は履歴として保存。
2. 最終確認時、並行作業の `lab.html:4` にはprofiles/timingの読み込みが追加されていた。一方、音声scriptはなお `lab/audio.js` で、`lab/main.js` のdown/sound handlerはunlock/toggleを呼ぶ。`lab/audio.js` には新APIが存在する場合のadapterも追加されているが、HTMLにはまだ今回のdsp/temporal/engine/audioの読み込みがない。今回の所有範囲に従い本編を変更せず、上記新APIで音響ページを検証。本編のwave接続・描画同期は並行作業の確認待ち。
3. 正本§2のsponge/beadslime preおよびbubble postには数値がない。仕様矛盾として埋めず、dataはnull、UIは秒数未指定を表示。音響collapseの調整値とUIの可変バー幅を正本由来の時間と扱わない。
