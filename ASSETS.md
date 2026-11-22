# Asset provenance

T5ではT4のFX13枚とクリーム芯altを統合（現行マッピングは下記）。

T3ではdirector採用済みの `assets/art/` の10枚をゲームに統合。原画像・採用PNGは変更せず、実行時に必要サイズへキャッシュして使用します。新しい画像生成や有料サービスの利用はありません。

- キャラクター：OpenAI image_gen生成のRGBA PNG。背景、クリーム芯、画像欠落時のキャラクターと粒子：game.js 内の手続き描画。
- サウンド：`audio.js` 内のオリジナル手続きDSP（下記）。実録ではありません。
- 外部録音・ストック素材：なし。生成画像の出所・利用条件の記録は [assets/ART_LOG.md](assets/ART_LOG.md) を参照（CC0素材とは扱わない）。

今後の生成素材を追加するときは、ファイル名・生成方法・生成日時・生成プロンプト・採用/不採用・商用利用条件・帰属表示要否を記録すること。

## 採用画像の実行経路 — T3 / T5

`sprites.js` がclassic scriptとして `audio.js` と `game.js` の間に読み込まれ、`new Image()` と相対srcでロード。fetch・XHR・ES modules・外部ライブラリは不要、file://で動作する。全画像のload/error確定後に開始可能。失敗した状態だけ元の手続き描画を使用し、ファイルごと1回だけconsole.warnを出す。

| 状態 | 採用ファイル | 半径 / キャッシュ辺 px |
|---|---|---:|
| wax stage 0/1 | wax_0/1.png | 64 / 141 |
| wax stage 2（T5採用） | alt/wax_2_alt.png | 64 / 141 |
| bubble | bubble_0.png | 58 / 128 |
| jelly（変形共通） | jelly_0.png | 62 / 136 |
| ice stage 0/1 | ice_0/1.png | 60 / 132 |
| boss act1・未破壊 | boss_0.png | 190 / 418 |
| boss act1・1層以上破壊 | boss_1.png | 190 / 418 |
| boss act2・芯 | boss_2.png | 190 / 418 |

384×384 RGBAを約2.2×hit radiusのoffscreen canvasへ一度だけ縮小。白いalphaマスクも一度だけ生成し、破断時60msの加算フラッシュに使用。pressure/jiggle/boingを同じ変形行列で適用。小敵状態・ボス各状態・debug hit circle・欠落時のスクリーンショットで目視確認済み。描画結果と当たり判定は同じ変形を使うが、凹凸は円で近似する。

`assets/ART_LOG.md` の冒頭にはimage_genと制作日2026-11-22が記録されている一方、個別節のTool/Dateにはundefinedが残る。個別実行日時を推定で埋めず、T2の履歴を維持した。生成プロンプト・参照画像・処理・hashは同ログと `assets/art/generation_manifest.json` / `verification.json` を参照。

## T5 FXの実行マッピング

T4で生成済みの13枚を統合。原画像・採用PNGは変更しない。新規の画像生成・外部サービス利用なし。生成記録と条件はART_LOGのT4を継承する。

| 演出 | ファイル（assets/art/fx/） |
|---|---|
| ロウ殻 | chip_wax_a/b/c.png |
| ボス層・最終の残り殻 | chunk_boss_a/b/c.png |
| 氷 | shard_ice_a/b/c.png |
| ゼリー / 泡 / ボス芯 | drop_jelly / drop_mint / drop_peach.png |
| キラキラ・タップ点の光 | sparkle.png |
| ロウのクリーム・ピンクしずく | drop_peach.pngを実行時キャッシュに72% source-atop着色（#fff4dc / #f6b2d1） |

各128pxのFXを18/26/36/46pxへ事前縮小、ボス殻のみ58/70pxも使用。FXキャッシュ66枚、敵キャッシュ10枚。ランタイムで粒子ごとのリサイズはしない。欠落ファイルごと1回警告し、その粒子は手続き描画にフォールバック。芯の90msのクリームblob、亀裂、柔らかなリングと暖白色bloomはgame.jsの手続き描画。T2のwax_2.pngは原版として保持し、ゲームでは使わない。

## synth_* SFX v3 — 2026-11-22

- 作成方法：このリポジトリ用に新規実装した plain JavaScript DSP。seeded PRNG、Float32Array、ノイズ励起の減衰共振器、粒状の微小インパルス、掃引フィルター、湿った低域、非整数倍モード、合成和音。外部サンプル、録音、音声生成サービス、外部ライブラリは使用していない。サービス費用なし。
- 正本：`audio.js` の `AudioDSP.render(name, variation, sampleRate)`。Node向け CommonJS export とブラウザの `window.ASMR.AudioDSP` が同じ関数を使う。
- 再現：`node tools/render-sfx.cjs`。保存先はリポジトリ直下の `assets_audio_preview/`（`assets/` の外）。ファイル接頭辞は必ず **`synth_`**。全17種×3 variation、48kHz / 16bit PCM / mono。
- 音名：`wax_crack`, `wax_break`, `wax_kill`, `bubble_pop`, `jelly_wobble`, `jelly_splat`, `ice_crack`, `ice_shatter`, `squish_creak`, `squish_pop`, `boss_layer_1`, `boss_layer_2`, `boss_layer_3`, `boss_core`, `boss_final`, `slash_finisher`, `boss_thud`。
- 例：`synth_wax_crack_1.wav`、`synth_boss_layer_3_2.wav`。試聴WAVはゲームの起動に不要。ゲームは最初のユーザー操作後に同じDSPから AudioBuffer を生成する。
- 処理：600–2500Hzフォームント雑音と700–3500Hzの上昇チャープ粒。最初のsnapより後続の粒を弱くし、DC除去・短いアタック／終端フェード。冒頭150ms固定窓のRMS正規化（短音は無音で補完）と−3.1dBFSのtanh上限。泡は3ms未満のsnapと小さなplip、最終解放はC5–E5–G5–B5＋控えめなオクターブの1.5秒。再生時に±3% rate jitter、五音音階、声数制限、既存コンプレッサー・高域シェルフ・マスター音量を維持。
- 測定：`assets_audio_preview/analysis.md` / `metrics.json`。量子化前、ミックス前の個別バッファ。全長ゼロ詰めFFTの電力比、RMS150、最強の連続1ms区間の開始時刻。51/51 PASS: 500–8000Hz ≥65.8%（要件50%）、泡2000–8000Hz ≥46.6%（要件35%）、破断ピーク最遅3.92ms（要件8ms）、peak ≤−3.10dBFS。各RMS目標の±0.01dB以内。全項目を `npm test` の先頭で強制し、違反時は非ゼロ終了。
- RMS150目標dBFS：per-hit・着地−21±2、break/kill−19±2、boss_final−17±2、squish_creak−26±3、slash_finisher−24±3。creak/finisherのみ発音時刻ゲートを免除。
- 独立確認：`python tools/analyze_sfx.py assets_audio_preview screenshots/sfx_spectrograms.png` はPCM16書き出し後のWAVをNumPyで再解析。スペクトログラムの最初のsnap、中域の湿った減衰、最終和音の長い余韻を目視確認。聴取したという主張ではない。
- 権利・出所：この作業で生成したコード由来の合成音。外部サンプルのライセンス・帰属表示条件はない。第三者素材の権利確認を済ませたという主張ではない。
- 採用状態：v0.2の合成SFXとして実装。**本物のASMR録音ではなく、聴感・快適さ・材質らしさは人間の耳チェック待ち**。自動の数値検査で音響品質や実機の安全な音量を保証しない。
