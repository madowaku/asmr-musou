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
