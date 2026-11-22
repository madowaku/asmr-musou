# ASMR無双 / ASMR MUSOU v0.2 tactile

45秒、玩具の殻を割り、泡をつなぎ、芯をむぎゅっと潰すブラウザゲーム。

## 起動と操作

1. `index.html` を Chrome で直接開く（ダブルクリック / `file://`）。サーバー不要。
2. 「さわってスタート」で開始。画像の読み込み完了（または欠落判定）までボタンは待機し、音源51個を最初の操作時に生成する。
3. タップで素材を割る。なぞると1ストロークにつき各敵1回、C D E G A…の上昇音。3体以上なら小さなフィニッシャー。
4. 約0.55秒の長押しでむぎゅっ。押す途中は変形・圧力リング・音が育つ。0.18秒以上押して途中で離すと無傷で戻る。
5. `🔊` は**音と振動**をまとめて切り替える。小さな音量から試すこと。振動は対応ブラウザ・端末のみ。

マウス・タッチ・ペンの Pointer Events を利用し、同時2ポインターまで対応。フォーカス喪失・キャンセル時は長押しを解除。タブ復帰では非表示時間を飛ばす。横画面の小さい端末には縦向き案内を表示する。

## 素材と45秒の流れ

- ロウ：3タップ。ツヤのある丸い殻 → 細いヒビ → 殻が落ちてマットなピンクの芯 → 破裂。長押しなら一度で潰せる。
- プチプチ：1タップで破裂。155px以内でつながる泡を40–70ms刻みで連鎖させる。
- ゼリー：低いしずく形。最初のタップでバネ振動とむにゅ音、次のタップか長押しで潰れる。
- 氷：角ばった結晶。1タップで白い亀裂、2タップで破片と響き。
- 小敵は最大8 / 10 / 12体。半径はロウ64 / 泡58 / ゼリー62 / 氷60（720×1280座標）。開始時から下部にも配置し、追加は下部 `y=990–1150` または左右 `y=440–1150` に短くフェードインして上昇する。空き位置を選び、近づいた小敵を穏やかに左右へ離す。プレイ領域の上端は `y=300`、HUD手前でフェードアウトする。
- 32秒でボス。残る小敵を得点つきの連続ポップで消し、追加出現を停止。半径150、中央 `y=640` へ短く落下し、着地で潰れと低音＋中域のthud。殻3層（各3ヒット）→ 芯（4タップまたは長押し1回）→ 大きな解放。殻への長押しは1ヒット。
- 撃破後は軽いボーナス敵。45秒で結果へ進む。ボス未撃破の減点はない。

破断は `fracture()` に集約。状態・破片・音源開始・波紋・振動を同時に切り替える。通常40ms / 撃破70ms / ボス層180msのヒットストップ（重複は最大値）、最終破裂450msのスローモーション。入力・描画・タイマーは止めない。小さな拡大と揺れのみで、赤フラッシュなし。

## 音とアート

**すべての音は `synth_*` の手続き合成で、実録ASMRではない。音の品質・快適さ・素材らしさは人間による耳チェックが必要。**

`audio.js` は seeded RNG と Float32Array DSP で17種×3 variationを事前生成する。中域の湿ったフォームント雑音、700–3500Hzの上昇チャープ粒、初速のあるクラック、氷の非整数倍共振を使う。泡は3ms未満のパチッという成分＋小さなplip。最後は中域の砕ける水音＋C5–E5–G5–B5と控えめなオクターブの1.5秒の余韻。冒頭150msのRMSを音の役割ごとに揃え、tanhでピークを−3.1dBFS以下に抑える。破断時は `AudioBufferSourceNode.start(AC.currentTime)` で再生し、±3% rate jitterとストローク内の五音音階を維持。1音名4声 / 全体16声まで（古い声を置換）。声ごとのGain → Compressor（−18dB、4:1）→ HighShelf（9kHz、−3dB）→ Master Gain。OFFでは再生中の声も止める。

採用済みの生成画像10枚を `sprites.js` が `new Image()` と相対 `src="assets/art/…png"` で読み込む。ロウ0/1/2、氷0/1、泡0、ゼリー0、ボス無傷0 / 1層以上破壊1 / 芯2。直径約2.2×半径のoffscreen canvasへ画像ごと・必要サイズごとに一度だけ縮小し、白いアルファマスクもキャッシュする。圧力・バネ・揺れは同じcanvas transformで適用し、破断時は60msの白い加算フラッシュ。最後の破裂にも短い残像がある。欠落画像はその状態だけ元の手続き描画へ戻り、1ファイル1回だけ `console.warn`。全画像の成功／失敗が確定してから表示するので、ロード途中で手続き絵が画像に切り替わらない。

`index.html?debug=1` で実際の当たり判定を緑線表示。タップとスワイプは同じ半径0.98×rの円を使い、押し込み・揺れで変形した楕円にも追従する。凹凸の小さい部分は円近似。破片はピンクのロウ、金色のボス殻、薄青の氷、ラベンダーのゼリー、ミントの泡。

古典的な `<script defer>` と `window.ASMR` を使い、ES modules、fetch、XHR、CDN、外部ライブラリはゲームに不要。パーティクル上限360。背景・グラデーション・縮小画像を再利用し、多数オブジェクトの `shadowBlur` は使用しない。

## 検証と試聴ファイル

Node.js とローカルの Google Chrome が必要。開発用依存は `package.json` の Playwright 1.56.1（ゲーム実行には不要）。この作業環境にはインストール済み。別環境では `npm install` で用意する。

```sh
npm run check
npm test
node tools/render-sfx.cjs
python tools/analyze_sfx.py assets_audio_preview screenshots/sfx_spectrograms.png
```

- `npm test` は **SFXゲート → smoke → perf** の順で実行する。Node + Playwright、`chromium.launch({ channel: 'chrome', headless: true })`、通信を無効にした `file://` を使う。Python版 `tests/smoke.py` は `tests/smoke.mjs` に置き換えた。
- メニュー、音声の初期化、素材段階、泡の連鎖間隔、実マウスのスワイプ・長押し・早離し、ボスの全段階、ミュート、声数上限、45秒終了・再挑戦を確認。360×640 / 412×915 は mobile + hasTouch の `touchscreen.tap` と回転を確認。console/page errorと外部通信は0件を要求。
- `screenshots/` に title / play / swipe / hold / boss_act1 / boss_damaged / boss_core / boss_final / result、wax_core・モバイル画像、全小敵状態のsprites_states、hitbox_debug、sprite_fracture、missing_sprite_fallbackを保存。実ファイルを欠落させた一時コピーでも進行と1回の警告を検証する（Chrome自身の意図したERR_FILE_NOT_FOUND診断は別扱い）。
- `assets_audio_preview/synth_<name>_<1..3>.wav` に48kHz・16bit・monoの全51音を書き出す。ゲームはこのWAVを読み込まず、同じDSPをブラウザで実行する。
- `assets_audio_preview/analysis.md` / `metrics.json` にduration、peak、RMS150、500–8000Hz電力比、2000–8000Hz電力比、最強の連続1ms区間の開始時刻を保存。RMS150は150ms固定窓（短音は無音で補完）、帯域は全バッファのゼロ詰めFFT電力。測定は量子化前・ミックスバス前。全音の電話帯域≥50%、peak≤−3dBFS、破断音のピーク時刻≤8ms、泡の2–8kHz≥35%を強制する。RMS目標はヒット−21±2 / 破壊−19±2 / 最終−17±2 / creak−26±3 / finisher−24±3 dBFS。違反は非ゼロ終了。
- T3測定: 全51音PASS。電話帯域最小65.8%、泡2–8kHz最小46.6%、破断ピーク最遅3.92ms、最大ピーク−3.10dBFS。RMS150は各目標の±0.01dB以内。Pythonの独立したWAV再解析とスペクトログラムも確認。
- `tests/perf.mjs` はCDPの `Emulation.setCPUThrottlingRate {rate:4}` で10秒の連続スワイプ。各フレーム12小敵＋ボスを補充し、音ON・破片込みの `update+draw` を `performance.now()` で測る。補充処理も計測内。p95<8msを要求し、フレーム数・平均・p95・最大・最少敵数・最大粒子数を `screenshots/perf.json` に保存する。GPU描画完了・イベント処理・実機FPSの測定ではない。
- T3最終計測（Chrome 158、4×CPU、10.14秒、731フレーム・36スワイプ）: 平均3.97ms / p95 5.60ms / 最大32.20ms。全フレーム13体以上、粒子最大360。p95目標は達成、単発の最大値は16.7msを超える。
- テスト用 `window.__asmrTest` に getState（stage/act含む）、hitAt、spawn、skipTo、end、audioStats 等。`?seed=1` で素材配置と音の変化を再現可能。長押し・タッチは実入力で検証。

## 残る確認

自動テストは人間の試遊・耳チェックを代用しない。Android実機の60fps、熱、入力遅延、振動、スピーカー／イヤホンでの音量・快適さは未検証。初回のDSP生成時間も実機で確認が必要。音源単体の検査は全ミックスの音圧・聴感を保証しない。4倍CPU制限もAndroid実機の代用ではなく、最大フレーム時間のスパイクは別に記録する。生成アートの細いヒビは小画面では控えめ。公開は行っていない。

`ORCHESTRATOR_BRIEF.md` 冒頭の「v0.1」「Python smoke」「リアルタイム仮音」は出発点の記述。このv0.2では本READMEのNodeテスト・事前生成DSPを採用している。ゼリーは今回の具体的な操作仕様（1回目で揺れ、次のタップで潰す）に従っている。

T3では旧READMEの「画像未統合・ボスy=560・ピーク正規化・600粒子」を今回の指示に沿って更新。`assets/ART_LOG.md` のT2範囲外の記述は履歴として維持。各画像節の `Tool: undefined` / `Date: undefined` は元ログの欠落で、冒頭のimage_gen・制作日2026-11-22という記録を参照しているが、個別実行日時は未確認。

素材の生成方法と出所は [ASSETS.md](ASSETS.md)、全体の方針は [ORCHESTRATOR_BRIEF.md](ORCHESTRATOR_BRIEF.md) を参照。
