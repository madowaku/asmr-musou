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

- ロウ：3タップ。ツヤのある丸い殻 → 白い亀裂 → 殻が落ちてクリームの芯 → 芯が90ms膨らんで飛散。長押しなら一度で潰せる。
- プチプチ：1タップで破裂。中心間距離3.6×半径（泡58なら208.8）以内でつながる泡をBFSでたどり、40–70ms刻みで連鎖させる。3体以上の空きがある追加出現では85%の確率で3〜5体の密な群れを試みる。隣同士は直径の92.5%間隔、既存の敵とは半径の和の85%以上を空け、空きがなければ通常の単体出現を試す。
- ゼリー：低いしずく形。最初のタップでバネ振動とむにゅ音、次のタップか長押しで潰れる。
- 氷：角ばった結晶。1タップで白い亀裂、2タップで破片と響き。
- 小敵は最大8 / 10 / 12体。半径はロウ64 / 泡58 / ゼリー62 / 氷60（720×1280座標）。開幕7体は最初の8秒、または触れるまで小さく揺れるだけで待つ。その後は10〜22 u/sを基準に揺れながら漂い、端と近隣の敵を見て滑らかに進路を変える。中心の範囲は `x=[r,720−r]`、`y=[300+0.6r,1280−0.4r]`。上端でも透明化・削除されず、タップできる。密度は出現上限で制御し、未破壊の敵は退場させない。単体の追加は下部 `y=990–1150` または左右 `y=440–1150`、泡の群れはプレイ領域の空きに短くフェードインする。
- 32秒でボス。残る小敵を得点つきの連続ポップで消し、追加出現を停止。半径190、中央 `y=660` へ`y=515` からHUD下で短く落下し、着地で潰れと低音＋中域のthud。殻3層（各3ヒット）→ 芯（4タップまたは長押し1回）→ 大きな解放。殻への長押しは1ヒット。
- 撃破後は軽いボーナス敵。45秒で結果へ進む。ボス未撃破の減点はない。

破断は `fracture()` に集約。状態・破片・音源開始・波紋・振動を同時に切り替える。通常40ms / 撃破70ms / ボス層180msのヒットストップ（重複は最大値）、最終破裂450msのスローモーション。入力・描画・タイマーは止めない。小さな拡大と揺れのみで、赤フラッシュなし。

## 音とアート

**すべての音は `synth_*` の手続き合成で、実録ASMRではない。音の品質・快適さ・素材らしさは人間による耳チェックが必要。**

`audio.js` は seeded RNG と Float32Array DSP で17種×3 variationを事前生成する。中域の湿ったフォームント雑音、700–3500Hzの上昇チャープ粒、初速のあるクラック、氷の非整数倍共振を使う。泡は3ms未満のパチッという成分＋小さなplip。最後は中域の砕ける水音＋C5–E5–G5–B5と控えめなオクターブの1.5秒の余韻。冒頭150msのRMSを音の役割ごとに揃え、tanhでピークを−3.1dBFS以下に抑える。破断時は `AudioBufferSourceNode.start(AC.currentTime)` で再生し、±3% rate jitterとストローク内の五音音階を維持。1音名4声 / 全体16声まで（古い声を置換）。声ごとのGain → Compressor（−18dB、4:1）→ HighShelf（9kHz、−3dB）→ Master Gain。OFFでは再生中の声も止める。

採用済みの敵画像10枚（ロウstage 2は `alt/wax_2_alt.png`）とFX13枚を `sprites.js` が `new Image()` と相対 `src="assets/art/…png"` で読み込む。ロウ0/1/2、氷0/1、泡0、ゼリー0、ボス無傷0 / 1層以上破壊1 / 芯2。直径約2.2×半径のoffscreen canvasへ画像ごと・必要サイズごとに一度だけ縮小し、白いアルファマスクもキャッシュする。圧力・バネ・揺れは同じcanvas transformで適用し、破断時は60msの白い加算フラッシュ。ロウ・氷のstage 1にはタップ位置を変形のローカル座標へ戻した白い亀裂を重ね、250msの太い閃きから細い白線へ落ち着く。撃破時はロウのクリーム芯90ms、ゼリーの水たまり80ms、ボスの芯140msを描いてからしずくと柔らかな一度きりのリングへ移る。音・得点・撃破判定は最初のフレームで確定。ボス最終は450msのスローと400msの暖白色ブルーム（最大alpha .23）。欠落画像はその状態だけ元の手続き描画へ戻り、1ファイル1回だけ `console.warn`。全画像の成功／失敗が確定してから表示するので、ロード途中で手続き絵が画像に切り替わらない。

`index.html?debug=1` で実際の当たり判定を緑線表示。タップとスワイプは同じ半径0.98×rの円を使い、押し込み・揺れで変形した楕円にも追従する。凹凸の小さい部分は円近似。破片は `chip_wax_*` / `chunk_boss_*` / `shard_ice_*`、しずくは `drop_jelly` / `drop_mint` / `drop_peach`、光は `sparkle`。18 / 26 / 36 / 46px（ボス殻は58 / 70pxも）の縮小キャッシュを使い、回転・スピン・重力・空気抵抗、寿命の最後30%のフェードを適用。ロウの芯はpeachしずくを起動時にクリームとピンクへ着色したキャッシュ。FX欠落時も手続き描画で継続。

古典的な `<script defer>` と `window.ASMR` を使い、ES modules、fetch、XHR、CDN、外部ライブラリはゲームに不要。パーティクル上限360。ポップアップ上限6、重なる文字は上へずらし、古い文字を早く薄くする。SLASHは最後に当たった敵の上に少し大きく表示。背景・グラデーション・縮小画像を再利用し、多数オブジェクトの `shadowBlur` は使用しない。

## 人間の耳チェック

[soundboard.html](soundboard.html) をChromeで直接開く。`audio.js` を共有し、17種の `synth_*` 各3variation、全51音の順番再生、音ごとの3種連続・Rapid-fire ×10、停止とMaster volumeを用意。初期音量35%。単音と順番再生は速度固定、連打はゲームと同じ速度ゆらぎ・声数制限を使う。ページを離れると停止する。ゲーム画面にはリンクを増やしていない。

## 実機テスト

1. PCとAndroid端末を同じWi-Fiにつなぐ。
2. リポジトリのフォルダで `python -m http.server 8000` を実行する。
3. PCのLAN IPv4アドレスを確認する（Windowsでは `ipconfig` のWi-Fi欄）。
4. AndroidのChromeで `http://<PC LAN IP>:8000/` を開く。例: `http://192.168.1.20:8000/`。つながらない場合はPCのプライベートネットワークでPythonの通信を許可し、ゲストWi-Fiの端末隔離を確認する。
5. 試聴ページは同じアドレスの `/soundboard.html`。終了したらPC側で Ctrl+C。これはLAN内のテスト用で、公開作業は行わない。

- [ ] 最初のスタートタップ後から音が出る／初回準備が長すぎない
- [ ] 破断時に振動し、音OFFでは振動も止まる（端末が対応している場合）
- [ ] なぞり・長押し・連鎖・ボスで60fps程度の滑らかさがある
- [ ] 5回続けて遊んだ後の発熱・速度低下
- [ ] HUD、亀裂、素材段階、SLASHの文字が読みやすい
- [ ] イヤホンとスピーカー両方で音量・高音・連打の重なりが快適

## 検証と試聴ファイル

Node.js とローカルの Google Chrome が必要。開発用依存は `package.json` の Playwright 1.56.1（ゲーム実行には不要）。この作業環境にはインストール済み。別環境では `npm install` で用意する。

```sh
npm run check
npm test
node tools/render-sfx.cjs
python tools/analyze_sfx.py assets_audio_preview screenshots/sfx_spectrograms.png
```

- `npm test` は **SFXゲート → smoke → drift-chain → perf** の順で実行する。Node + Playwright、`chromium.launch({ channel: 'chrome', headless: true })` を使用。smoke / perf は通信を無効にした `file://`、drift-chain は自動起動・終了するループバックHTTPサーバーを使う。Python版 `tests/smoke.py` は `tests/smoke.mjs` に置き換えた。
- メニュー、音声の初期化、素材段階、泡の連鎖間隔、実マウスのスワイプ・長押し・早離し、ボスの全段階、ミュート、声数上限、45秒終了・再挑戦を確認。360×640 / 412×915 は mobile + hasTouch の `touchscreen.tap` と回転を確認。console/page errorと外部通信は0件を要求。
- `tests/drift-chain.mjs` は375×812・HTTPで、開幕ロウの8秒実時間生存と20秒無入力の全フレーム（ID・位置・境界・消失）を検証。開幕群への実タッチ1回で3体が0.3秒以内に破裂し、seed=1の通常45秒を泡のみの実タッチで進めて3体以上の連鎖が3回以上起きることを確認する。自然出現群の大きさ・密着・重なりと密度上限もチェック。補助の仮想時計テストでは四辺・角からの復帰、待機の早期解除、上端へのタップ、200単位のBFS接続と220単位の非接続を確認する。`drift-chain.json` に集計、`play.png` / `swipe.png` に同サイズの実プレイ画面を保存する。
- `screenshots/` に title / play / swipe / hold / boss_act1 / boss_damaged / boss_core / boss_final / result、wax_core・モバイル画像、全小敵状態のsprites_states、hitbox_debug、sprite_fracture、missing_sprite_fallback / missing_fx_fallback、soundboardのPC・モバイル画像を保存。実ファイルを欠落させた一時コピーでも進行と1回の警告を検証する（Chrome自身の意図したERR_FILE_NOT_FOUND診断は別扱い）。
- `screenshots/wax_frames.png` は3タップ×6フレーム、`boss_final_frames.png` は最終破断18フレーム（6列×3行）。`tests/frame-strips.mjs` で `page.clock.install()` / `pauseAt()`、実マウスタップ後の最初の描画から `runFor(33)` 刻みで取得。ラベルの時刻は入力からの進行時間。`frame_states.json` に同時刻の芯タイマー・FX・bloom・ringを保存。
- `assets_audio_preview/synth_<name>_<1..3>.wav` に48kHz・16bit・monoの全51音を書き出す。ゲームはこのWAVを読み込まず、同じDSPをブラウザで実行する。
- `assets_audio_preview/analysis.md` / `metrics.json` にduration、peak、RMS150、500–8000Hz電力比、2000–8000Hz電力比、最強の連続1ms区間の開始時刻を保存。RMS150は150ms固定窓（短音は無音で補完）、帯域は全バッファのゼロ詰めFFT電力。測定は量子化前・ミックスバス前。全音の電話帯域≥50%、peak≤−3dBFS、破断音のピーク時刻≤8ms、泡の2–8kHz≥35%を強制する。RMS目標はヒット−21±2 / 破壊−19±2 / 最終−17±2 / creak−26±3 / finisher−24±3 dBFS。違反は非ゼロ終了。
- T3測定: 全51音PASS。電話帯域最小65.8%、泡2–8kHz最小46.6%、破断ピーク最遅3.92ms、最大ピーク−3.10dBFS。RMS150は各目標の±0.01dB以内。Pythonの独立したWAV再解析とスペクトログラムも確認。
- `tests/perf.mjs` はCDPの `Emulation.setCPUThrottlingRate {rate:4}` で10秒の連続スワイプ。各フレーム12小敵＋ボスを補充し、音ON・破片込みの `update+draw` を `performance.now()` で測る。補充処理も計測内。p95<8msを要求し、フレーム数・平均・p95・最大・最少敵数・最大粒子数を `screenshots/perf.json` に保存する。GPU描画完了・イベント処理・実機FPSの測定ではない。
- T3最終計測（Chrome 158、4×CPU、10.14秒、731フレーム・36スワイプ）: 平均3.97ms / p95 5.60ms / 最大32.20ms。全フレーム13体以上、粒子最大360。p95目標は達成、単発の最大値は16.7msを超える。
- T5最終計測（Chrome 158.0.8127.36、4×CPU、10.26秒、739フレーム・31スワイプ）: 平均4.44ms / p95 **6.40ms < 8ms** / 最大8.50ms。最少13敵・粒子最大360。`npm run check` と `npm test`（51音のSFXゲート・smoke 20項目・perf）PASS。FX欠落、90ms芯、popup非重複、soundboardも検証。
- T6最終計測（Chrome 158.0.8127.36、4×CPU、10.05秒、716フレーム・28スワイプ）: 平均4.55ms / p95 **6.50ms < 8ms** / 最大48.90ms。最少13敵・粒子最大350。`npm run check` と `npm test`（51音・smoke 20項目・HTTPのT6回帰・perf）PASS。開幕ロウの実時間8秒生存、20秒・1508フレームで消失0、開幕3泡120ms、通常45秒の泡だけタップで3体以上の連鎖19回を確認。単発の最大フレーム時間は16.7msを超えており、Android実機の滑らかさを保証する測定ではない。
- テスト用 `window.__asmrTest` に getState（stage/act/queued/resting含む）、hitAt、spawn、skipTo、end、audioStats 等。`trace(true)` で描画フレームごとのID・座標と破壊・連鎖イベントを採取し、`trace(false)` で回収・停止する（通常プレイとperfでは無効）。`spawn(type,x,y,false)` は移動する検証用の敵。`?seed=1` で素材配置と音の変化を再現可能。長押し・タッチは実入力で検証。

## 残る確認

自動テストは人間の試遊・耳チェックを代用しない。Android実機の60fps、熱、入力遅延、振動、スピーカー／イヤホンでの音量・快適さは未検証。初回のDSP生成時間も実機で確認が必要。音源単体の検査は全ミックスの音圧・聴感を保証しない。4倍CPU制限もAndroid実機の代用ではなく、最大フレーム時間のスパイクは別に記録する。亀裂は白線で補強済み。90msの芯の膨らみが実機の連打でも伝わるかは人間の試遊で確認する。公開は行っていない。

`ORCHESTRATOR_BRIEF.md` 冒頭の「v0.1」「Python smoke」「リアルタイム仮音」は出発点の記述。このv0.2では本READMEのNodeテスト・事前生成DSPを採用している。ゼリーは今回の具体的な操作仕様（1回目で揺れ、次のタップで潰す）に従っている。

T6では実機試遊に基づく指示を優先し、旧READMEの155px連鎖・上昇移動・HUD手前のフェード退場と、smokeの上昇方向限定の期待値を更新。ボスの32秒登場・得点つき連続ポップ・殻と芯・ボーナス移行は維持。

T3では旧READMEの「画像未統合・ボスy=560・ピーク正規化・600粒子」を今回の指示に沿って更新。`assets/ART_LOG.md` のT2範囲外の記述は履歴として維持。各画像節の `Tool: undefined` / `Date: undefined` は元ログの欠落で、冒頭のimage_gen・制作日2026-11-22という記録を参照しているが、個別実行日時は未確認。

素材の生成方法と出所は [ASSETS.md](ASSETS.md)、全体の方針は [ORCHESTRATOR_BRIEF.md](ORCHESTRATOR_BRIEF.md) を参照。

## COMBAT LAB (combat.html) — v0.4 研究

素材破壊に**ゲーム性**を足す研究。3キャラ（SLASHER 大剣士／CRUSHER 拳闘士／CASTER 魔法使い）で、60秒（雑魚の陣形ラッシュ → 巨大素材ボス → 大規模破壊 → 余韻）を戦う。
- 試遊：`combat.html`（スマホ：https://research-v0-4-combat.asmr-musou.pages.dev/combat.html ）。人間の評価シートは [docs/v0.4/PLAYTEST_COMBAT.md](docs/v0.4/PLAYTEST_COMBAT.md)。
- 設計の仮説：[docs/v0.4/COMBAT_DESIGN.md](docs/v0.4/COMBAT_DESIGN.md)。研究記録（失敗・AI の客観検証）：[docs/v0.4/research_log/V04_COMBAT_LOG.md](docs/v0.4/research_log/V04_COMBAT_LOG.md)。
- 操作（共通）：なぞる＝キャラが軌跡どおりに動いて攻撃／長押し→引いて離す＝狙った大技／タップ＝その場の小技。
- テスト：`node tests/combat/sim.mjs 1,2,3`（自動プレイヤー 3段階 × 3キャラ、決まった結果になる模擬）、`node tests/combat/input.mjs`（実際のポインター入力と描画込みの性能）、`node tests/combat/ui-shots.mjs`（画面の撮影）。

## ASMR素材研究所 (lab.html) — v0.3 研究

**試遊する人へ**：[試遊ガイドと評価シート](docs/v0.3/PLAYTEST_GUIDE.md)／研究のまとめは [REPORT_v0.3_lab.md](REPORT_v0.3_lab.md)。

`lab.html` を Chrome で直接開く（file:// で動く。WebGL2 が必要）。v0.2 とは独立した実験場で、方向性は [DIRECTION_v0.3.md](docs/v0.3/DIRECTION_v0.3.md)、時間構造の設計は [ASMR_TEMPORAL_STRUCTURE.md](docs/v0.3/ASMR_TEMPORAL_STRUCTURE.md)。

- **8素材**：ロウ、ゼリー、石鹸、砂、吸水スポンジ、チョーク、粒入りスライム、琥珀糖。素材ごとに予兆→解放→余韻の時間構造がある（例：スポンジは長押しで絞る、砂は長く崩れ続ける）。
- **斬撃**：指の軌跡どおりに切断され、切った瞬間に断面（内部）が見える。群れには刃の吸い寄せが効き、ジグザグの一振りで20体以上を倒せる。
- **音**：素材と連動した合成音（`synth_*`。録音ではない）。撃破数に応じて「破断の波」の質感が変わる。最初のタップで音が有効になる。試聴は `lab-audio.html`。
- **操作**：素材の選択、1体を置く、群れ（N体）、¼スロー、一時停止、1コマ送り、線表示、音、録画（R：9:16 WebM、音あり）、直前のカットの¼リプレイ（L）。
- **テスト**：`npm run test:lab`（幾何、アセット、ブラウザー、コマ送り、全素材のコマ送り、CPU 4倍の性能）、`node tests/lab-audio/run.mjs`（音響ゲート）。
- **デモ動画の再録画**：`node tools/lab/record-demo.mjs` → `research/v03/video/`。
- **研究記録**：`docs/v0.3/research_log/`（R0A, R0B_art, R1_materials, R2_audio, DIRECTOR_REVIEW）。不採用案や失敗も記録している。
