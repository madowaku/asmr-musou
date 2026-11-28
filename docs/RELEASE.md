# CRUNCH FLOW 配布候補

リポジトリのルートで `python tools/build-release.py` を実行する。標準ライブラリのみで、現在のゲームから `release-build/<内容の識別子>/` を生成する。同じ内容を再生成すると同じ場所とZIPになる。

- `pages/` はCloudflare Pagesに渡す静的サイトのルート。入口は `index.html`。
- `asmr-musou-v1.5-html5.zip` は同じファイルを同じ相対パスで格納したitch.io用HTML5ゲーム。公開判断後の設定はHTML Game、Mobile Friendly、縦長の埋め込み（例 360×640）、Fullscreen Button。スマホはitch.ioの起動ボタンから開始する。
- セーブはブラウザのローカルストレージを利用する。配布先・ブラウザごとに独立する。
- 研究用の入口は元の `studio.html` と `studio/listen.html`。配布物にはゲームの入口だけが入り、公開プレイは音響Aを使用する。

## 検証

`node tests/studio/release.mjs` はZIPを一時展開し、異なるオリジンのローカルページからサンドボックス付きiframeに読み込む。Chromeスマホ表示で全画面への移行、指での破壊、Web Audioの非ゼロ出力、保存済み図鑑の再読込、撮影モードの720×1280 PNGを確認する。図鑑の検証にはクリア済みデータを用いる。

`node tests/studio/v10-verify.mjs` は8ステージを攻略し、結果から素材祭に進む。素材祭は8つの単独素材の場面と複合ボスで構成され、クリアを独立して記録する。

実機試遊では最初の攻撃、素材の切り替わり、最終ボスの音と見分けやすさ、最後の余韻を確認する。実際のitch.io内での再訪時の保存、iOS・Androidの出音と写真保存も公開判断前の確認項目。

## 本番の配布経路

v1.5 の正本は release/v1.5-packaging。共通ビルド 03ef1105cdff77cb のZIPの SHA-256 は d977a9ef58f6f8d27b06ca2de8280e5c66f5543767712a11d508eb7065c4475f。Pages の本番は https://asmr-musou.pages.dev/ 、itch.io は https://madowaku.itch.io/asmr-musou 。

Pages の deploy/production は生成物専用。次回もこのスクリプトで両方を生成し、release.mjs で検証する。検証済み pages/ の全ファイルで配信用ブランチを同期し、削除されたファイルも反映する。Cloudflare用の 404.html を維持し、展開時の改行変換を無効にする。承認後に通常の fast-forward push で配信。itch.io には同じビルドのZIPを使う。研究ブランチのプレビューは従来の ci/pages-build を使う。

2026-11-28 公開。ゲームソース 1699fe2、配信用コミット 2a2427c、Pages 本番デプロイ 333c635a。安定URLで配信された64ファイルがローカルの正本とSHA-256で一致した。通常開始・研究パラメータ無効・研究ページ404・日本語/英語・390×844の初撃とWeb Audio出力を確認。ブラウザ内に8ステージクリア済みの保存データを用意し、再読込後の素材祭と8素材のボスも確認した。正本では新規進行からエンディングまで自動攻略を実施。
