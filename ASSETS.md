# Asset provenance

現在のゲーム実行経路は外部の画像・音声素材を使用していません。並行制作中の `assets/art/` は未統合です。このT1作業では `assets/` を変更していません。

- キャラクター、背景、粒子：game.js 内の手続き描画。
- サウンド：`audio.js` 内のオリジナル手続きDSP（下記）。実録ではありません。
- 音声・画像の著作権が付く外部素材：なし。

今後の生成素材を追加するときは、ファイル名・生成方法・生成日時・生成プロンプト・採用/不採用・商用利用条件・帰属表示要否を記録すること。

## synth_* SFX v2 — 2026-11-22

- 作成方法：このリポジトリ用に新規実装した plain JavaScript DSP。seeded PRNG、Float32Array、ノイズ励起の減衰共振器、粒状の微小インパルス、掃引フィルター、湿った低域、非整数倍モード、合成和音。外部サンプル、録音、音声生成サービス、外部ライブラリは使用していない。サービス費用なし。
- 正本：`audio.js` の `AudioDSP.render(name, variation, sampleRate)`。Node向け CommonJS export とブラウザの `window.ASMR.AudioDSP` が同じ関数を使う。
- 再現：`node tools/render-sfx.cjs`。保存先はリポジトリ直下の `assets_audio_preview/`（`assets/` の外）。ファイル接頭辞は必ず **`synth_`**。全16種×3 variation、48kHz / 16bit PCM / mono。
- 音名：`wax_crack`, `wax_break`, `wax_kill`, `bubble_pop`, `jelly_wobble`, `jelly_splat`, `ice_crack`, `ice_shatter`, `squish_creak`, `squish_pop`, `boss_layer_1`, `boss_layer_2`, `boss_layer_3`, `boss_core`, `boss_final`, `slash_finisher`。
- 例：`synth_wax_crack_1.wav`、`synth_boss_layer_3_2.wav`。試聴WAVはゲームの起動に不要。ゲームは最初のユーザー操作後に同じDSPから AudioBuffer を生成する。
- 処理：DC除去、短いアタック／終端フェード、−6dBFSを基準に音ごとのtrimでピーク正規化。再生時に±3% rate jitter、声数制限、コンプレッサー、高域シェルフ、マスター音量。
- 測定：`assets_audio_preview/analysis.md`。個別音源のピーク・RMS・スペクトル重心。クリップ・無音・非有限値を自動検査する。
- 権利・出所：この作業で生成したコード由来の合成音。外部サンプルのライセンス・帰属表示条件はない。第三者素材の権利確認を済ませたという主張ではない。
- 採用状態：v0.2の合成SFXとして実装。**本物のASMR録音ではなく、聴感・快適さ・材質らしさは人間の耳チェック待ち**。自動の数値検査で音響品質や実機の安全な音量を保証しない。
