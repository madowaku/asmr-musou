
## T4

制作日: 2026-11-22。依頼範囲: debris/FX sprites + wax_2 alternative（ASSETS ONLY）。担当は `art/fx/`、`art/alt/`、`art/src/` の新規ファイルと、このT4節の追記のみ。ゲームへの組み込みとコミットは行っていない。他作業者によるゲーム・音・tests・tools・README/ASSETS等の変更には触れていない。

### 制作結果・推奨

- 内蔵 `tools.image_gen__imagegen` のみ使用。7回生成、6原画像を採用、1原画像を棄却。外部の有料API・CLI生成・APIキーは使用していない。
- FXは各128×128 RGBA PNG、13点。素材4ファミリーを各2×2シート（左上・右上・左下の3点、右下空白）から切り出し、sparkleだけ単独生成した。
- `art/alt/wax_2_alt.png` は384×384 RGBA。試行1回、採用1、棄却0（上限3回内）。`wax_0` の顔・位置・姿勢と既存の破損形状を維持し、露出した中身だけをマットなミルキークリーム色に変更。
- **推奨: wax_2_alt.png。** 80 pxで3か所のクリーム色の露出面がピンクの光沢殻と即座に区別でき、殻が外れた状態と柔らかい内部が伝わる。元の `wax_2.png` は変更しておらず、実装側での採用・差し替えは未実施。

| Final file(s) | Generated sheet / source | Attempts | Decision |
|---|---|---:|---|
| `art/fx/chip_wax_a.png`, `chip_wax_b.png`, `chip_wax_c.png` | `art/src/t4_wax_chips_attempt2.png` | 2 | attempt 1 rejected: gray-white haze and nonzero corner alpha; attempt 2 adopted: thin curved pink shells, distinct shapes, white broken rims |
| `art/fx/chunk_boss_a.png`, `chunk_boss_b.png`, `chunk_boss_c.png` | `art/src/t4_boss_chunks_attempt1.png` | 1 | adopted: thick golden / peach / pink 3-layer cross-sections |
| `art/fx/shard_ice_a.png`, `shard_ice_b.png`, `shard_ice_c.png` | `art/src/t4_ice_shards_attempt1.png` | 1 | adopted: broad wedge / slender spear / squat diamond, crisp cyan facets |
| `art/fx/drop_jelly.png`, `drop_mint.png`, `drop_peach.png` | `art/src/t4_goo_drops_attempt1.png` | 1 | adopted: lavender / mint / peach glossy plump drops |
| `art/fx/sparkle.png` | `art/src/t4_sparkle_attempt1.png` | 1 | adopted: simple 4-point white / pale-gold glint |
| `art/alt/wax_2_alt.png` | `art/src/t4_wax_alt_attempt1.png` | 1 | adopted: cream mochi core strongly separates from glossy pink shell at 80 px |

### 後処理・位置合わせ

既存 `art/tools/key_bg.py` の `clean_source` と `square_sprite` を読み取り専用で再利用した。`build_art.py` の既存PNGを書き換えるmain処理は実行していない。

- 原画像7枚は全て1254×1254のRGBA PNG。棄却を含め `art/src/t4_*_attempt*.png` に無変更コピーし、生成元とのSHA-256一致を確認。正確なプロンプト・参照は下記および `art/src/t4_generation_manifest.json`、生成元とコピーのハッシュは `art/src/t4_source_provenance.json`。
- FXシートは627×627のセルに切り分け。生成由来のalpha<16の低透明度ノイズをゼロ化してから、既存方式のalpha>=16の連結本体抽出、原寸2 pxの外周インセット、0.35 pxのソフトマットを適用。各片の境界中心を128 pxキャンバス中央に配置した。色・形状・ハイライトをコードで描き直していない。
- 全採用品で元のアルファを使用。クロマキーは不要。ピンク殻attempt 1の背景もやは強引なキー処理で採用せず、画像生成で背景除去を再試行してattempt 2を採用した。
- 余白はFXで名目8%。premultiplied alphaのLanczosで128×128へ縮小し、alpha<2と透明部の隠れたRGBをゼロ化。非ゼロalpha境界は8–10 px、alpha>=128の物体境界は最短10 px以上（約8%）。細いsparkle先端はソフトなalphaを保持。
- 最初の `t4_build.py` は、627 pxセルに名目余白を加えたcropがセル外に達し、Pillowの `box offset can't be negative` で最初のFX出力前に停止。元のスクリプト・PNGは上書きせず、新規 `t4_build_v2.py` で必要な分だけ透明パディングを加えて同じ関数を再利用した。`t4_preview/` はその失敗時のスライスのみで不採用。`t4_preview_v2/` が検証済み候補。
- wax代替案は既存 `art/verification.json` のwax_0グループ値をそのまま使用: source center=(622.0,648.5)、shared extent=1023.0、margin=0.06。同じ1254 px原画座標から同じcrop/scaleで384 px化し、個別の顔基準cropや拡大率変更はしていない。
- 最終ファイルは目視採用後に候補から排他的な新規作成でコピーし、候補と最終のハッシュ一致を確認。

再処理のコード: `python -B assets/art/src/t4_build_v2.py`。既存成果物を保護するため出力フォルダが既に存在すると停止する。これは上書き再構築用ではなく、既存ファイルを保持した生成記録。新しい再検討時は別の未使用出力フォルダに変更した新規スクリプトを作ること。

### 検証と目視

- **14/14 PASS**: PNG / RGBA、FX13点128×128、wax代替1点384×384。各ファイルの四隅alpha=`[0,0,0,0]`、外周全辺alpha=0、透明部の隠れたRGB=0。検査結果を端末出力した。
- `art/fx/fx_sheet.png`: 896×1070。各FXを128 px実寸と16 / 24 / 40 pxで、指定背景#2a2647に表示。
- `art/alt/wax_compare.png`: 1664×634。wax_0 / wax_1 / wax_2 / wax_2_altを384 pxと80 pxで表示。
- 両シートおよび `art/src/t4_preview_v2/fx_gameplay_scale.png`、`wax_compare_80.png` を自分で目視確認。ピンク片の白リム、厚い層、氷の尖り、3色しずく、単純なglintを確認した。24 pxでも素材と色が区別でき、16 pxでも輪郭を保持。細いshard_ice_bは意図的な針状の細い形で、最小サイズでは細かい面情報は省略される。再生成後のピンク片に白もや・矩形背景は見られない。
- wax代替の顔は2眼とU字の笑顔を保持。暗紫顔ピクセルの補助測定ではwax_0に対する重心差0.152 px（384 px時）、80 px換算0.032 px。顔bboxはwax_0=(128,167,255,222)、alt=(128,167,255,223)。元の配置と共通cropを維持し、別途強制位置合わせはしていない。
- `art/src/t4_verification.json`: 最終ファイルのハッシュ、寸法、alpha・余白、元画像情報、共通crop、顔位置測定と目視判断。
- 開始前から存在したart内PNG22枚を全数ハッシュ比較し、無変更を確認。`ART_LOG.md` は元のバイト列を保持した追記のみ。ゲームへの組み込み・動画中の見え方・端末・人間の試遊は検証していない。
- 氷の透け感は主として焼き込まれた光学的陰影。元のalphaを保持した内部中央値は252–253/255であり、背景が強く透過する物理的ガラス表現とはしていない。sparkleは縁に部分透明を保持。

### 既存記録との相違・扱い

1. T2の「検証と目視確認」末尾（この追記前の58行目）は「殻の有無は80 pxでも判別できる」と評価していた。一方今回のディレクター指摘は内部と殻が同じピンクで読みにくいというもの。今回のT4指示を優先して別ファイルの代替案を制作し、既存の採用画像や記述は書き換えていない。
2. T2の個別生成記録では `Tool: undefined` / `Date: undefined`（最初は80–81行目、他の9点も同様）になっているが、T2冒頭には内蔵image_gen・制作日の記載がある。今回の追記のみという制約に従い、古い個別記録は修復せず、当時の各実行日時は未確認のまま残した。T4では実際に呼んだツール名と制作日を明記した。

### 正確なT4プロンプト

参照画像はすべてこのプロジェクトの既存生成素材または今回生成した素材。style matchingは既存ART_LOGとcontact_sheetの目視に基づき、上左照明・toy material・パレットをプロンプトに記載した。

#### wax_alt_attempt1

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_wax_alt_attempt1.png`
- Status: adopted
- References: `assets/art/src/wax_2_attempt1.png`, `assets/art/src/wax_0_attempt1.png`

```text
Use case: precise-object-edit. ONE separate square production sprite for ASMR MUSOU, alternate damage state wax_2_alt.
Image 1 is the EDIT TARGET: approved damaged wax_2 raw sprite. Image 2 is the IDENTITY AND REGISTRATION reference wax_0. Preserve their exact body center, size, slightly tall round silhouette, framing, front camera angle, two dark plum oval eyes and U smile, face size and positions, strawberry-pink glossy candy-wax shell color, upper-left studio lighting and clean unoutlined toy-render style.
Change ONLY the exposed interior visible inside the THREE LARGE existing broken-shell gaps (upper-right, left/lower-left, lower-right). Turn those currently pink soft interior areas into clearly different WARM MILKY WHITE / SOFT MATTE CREAM MOCHI, pale ivory around #fff4dc. Gentle broad rounded squashy bulges through the missing shell areas, soft powdery smooth mochi surface, subdued diffuse highlights only, NO shiny plastic highlights on cream. Shell remains glossy strawberry-pink around the cream with wafer-thin broken pale rim edges. Keep the central pink face-bearing shell patch and facial features unchanged. The cream areas must be unmistakably cream versus pink at only 80 px. Approximately 40 percent of visible body shows cream.
Absolutely preserve original overall silhouette envelope, exact source canvas coordinates and full body framing. Do not enlarge, recenter, rotate, move or redraw face. Do not add detached fragments, droplets, cracks over eyes, limbs, extra face, floor or shadows outside body.
REAL transparent RGBA background, no checkerboard artwork or colored background, no text, no watermark. Retain generous existing transparent margins. Output same square composition as supplied images.
```


#### wax_chips_attempt1

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_wax_chips_attempt1.png`
- Status: rejected (white/gray background haze; regenerated as attempt 2)
- References: none (new generation; style described in prompt)

```text
Use case: stylized-concept. Production game debris sprite sheet for ASMR MUSOU. Square image with a strict invisible 2 by 2 equal-square grid. Exactly THREE isolated objects: top-left, top-right, bottom-left; bottom-right cell ENTIRELY EMPTY. Each object centered in its own cell, fitting within the central 72 percent of that cell, generous transparent gutters. No labels, grid lines, borders, text or extra objects.
Style: premium tactile toy macro 2.5D render, simple clean silhouette, no black ink outline. Soft studio key light UPPER LEFT, broad white glints and a subtle lower-right colored shade. Bright candy pastels. High contrast readable shapes when individually reduced to 16–40 pixels and displayed on navy #2a2647. Object floats freely, no floor, no cast ground shadow. REAL transparent RGBA background with clean alpha cutouts, no baked checkerboard, no background color.
Family: thin strawberry-pink glossy candy-WAX SHELL FRAGMENTS, matching a pink wax-coated round squishy toy. NOT gems, not petals, not solid pink chunks. Thin curved shell surface with a clearly visible delicate WHITE BROKEN RIM HIGHLIGHT. Outside pink #f797b3, inner shell pale pink, all surfaces subtly waxy. Each piece should show its thin cross-section and concave-curved form.
Top-left: one broad curved crescent-shaped shell chip with a sharp uneven snapped edge facing viewer.
Top-right: one squat irregular four-sided curved shell flake, slightly bent, white broken rim along lower front edge.
Bottom-left: one irregular triangular curled shell chip with a small corner curling upward and white snapped rim.
Three DIFFERENT simple silhouettes, only a single connected fragment per cell, no tiny loose bits, no faces.
```


#### boss_chunks_attempt1

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_boss_chunks_attempt1.png`
- Status: adopted
- References: none (new generation; style described in prompt)

```text
Use case: stylized-concept. Production game debris sprite sheet for ASMR MUSOU. Square image with a strict invisible 2 by 2 equal-square grid. Exactly THREE isolated objects: top-left, top-right, bottom-left; bottom-right cell ENTIRELY EMPTY. Each object centered in its own cell, fitting within the central 72 percent of that cell, generous transparent gutters. No labels, grid lines, borders, text or extra objects.
Style: premium tactile toy macro 2.5D render, simple clean silhouette, no black ink outline. Soft studio key light UPPER LEFT, broad white glints and a subtle lower-right colored shade. Bright candy pastels. High contrast readable shapes when individually reduced to 16–40 pixels and displayed on navy #2a2647. Object floats freely, no floor, no cast ground shadow. REAL transparent RGBA background with clean alpha cutouts, no baked checkerboard, no background color.
Family: THICK GOLDEN-PEACH layered WAX SHELL CHUNKS, broken from a round golden peach toy boss. Thick curved coating fragments with THREE visibly separate stacked layers on their large viewer-facing broken edge: top golden apricot #ffd17e, middle pale peach #ffc5a7, bottom soft pink #f5adc6. Broad colored stepped bands, visible at 24 px, substantial thickness, not a thin flake. Glossy smooth outer surface and waxy cut surfaces.
Top-left: one chunky curved triangular wedge, wide stepped cross-section facing front.
Top-right: one squat trapezoidal curved chunk, thick 3-layer broken edge at bottom and right.
Bottom-left: one thick bent crescent chunk, three layers visible across broad inner broken edge.
One connected fragment per cell, simple distinct silhouettes, no faces, no loose specks.
```


#### ice_shards_attempt1

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_ice_shards_attempt1.png`
- Status: adopted
- References: none (new generation; style described in prompt)

```text
Use case: stylized-concept. Production game debris sprite sheet for ASMR MUSOU. Square image with a strict invisible 2 by 2 equal-square grid. Exactly THREE isolated objects: top-left, top-right, bottom-left; bottom-right cell ENTIRELY EMPTY. Each object centered in its own cell, fitting within the central 72 percent of that cell, generous transparent gutters. No labels, grid lines, borders, text or extra objects.
Style: premium tactile toy macro 2.5D render, simple clean silhouette, no black ink outline. Soft studio key light UPPER LEFT, broad white glints and a subtle lower-right colored shade. Bright candy pastels. High contrast readable shapes when individually reduced to 16–40 pixels and displayed on navy #2a2647. Object floats freely, no floor, no cast ground shadow. REAL transparent RGBA background with clean alpha cutouts, no baked checkerboard, no background color.
Family: sharp pale-blue translucent ICE SHARDS matching a bright icy-blue candy-crystal toy. Clean 3D glassy facets, pale cyan #a6e0f5 and snowy-white upper-left highlights, richer cyan thin edge. Real subtle transparency in interior facets; readable bright silhouette on dark background. Keep 2–3 large facets per shard, no complex cracks, no snowy dust or glow.
Top-left: one broad asymmetrical triangular wedge shard, wide base, sharp long tip tilted upper-right.
Top-right: one narrow diagonal spear-like shard with sharp tip and angular broken base, clearly slimmer than first.
Bottom-left: one squat diamond/trapezoid fractured shard, short thick beveled form, distinct from first two.
Each is one connected fragment with crisp angular outline, no faces, no loose bits.
```


#### goo_drops_attempt1

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_goo_drops_attempt1.png`
- Status: adopted
- References: none (new generation; style described in prompt)

```text
Use case: stylized-concept. Production game debris sprite sheet for ASMR MUSOU. Square image with a strict invisible 2 by 2 equal-square grid. Exactly THREE isolated objects: top-left, top-right, bottom-left; bottom-right cell ENTIRELY EMPTY. Each object centered in its own cell, fitting within the central 72 percent of that cell, generous transparent gutters. No labels, grid lines, borders, text or extra objects.
Style: premium tactile toy macro 2.5D render, simple clean silhouette, no black ink outline. Soft studio key light UPPER LEFT, broad white glints and a subtle lower-right colored shade. Bright candy pastels. High contrast readable shapes when individually reduced to 16–40 pixels and displayed on navy #2a2647. Object floats freely, no floor, no cast ground shadow. REAL transparent RGBA background with clean alpha cutouts, no baked checkerboard, no background color.
Family: small glossy soft GOO DROPLETS from pastel squishy toys. Exactly one connected droplet per occupied cell. Smooth plump liquid gel material, gentle translucence, large white upper-left reflection for readability at 24 pixels. NO face, no attached tiny droplets, no splatter, no floor. Simple bulb with softly curved pointed tip and round plump base.
Top-left: LAVENDER jelly goo droplet #c3a0e8, tip gently leaning right.
Top-right: MINT goo droplet #b0e5cd, tip gently leaning left.
Bottom-left: PEACH goo droplet #ffc5ad, rounded upright tear shape with short point.
Keep saturation bright pastel and all three similar perceived size and gloss.
```


#### sparkle_attempt1

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_sparkle_attempt1.png`
- Status: adopted
- References: none (new generation; style described in prompt)

```text
Use case: stylized-concept. ONE production game FX sprite for ASMR MUSOU: a single soft FOUR-POINT STAR GLINT. Simple slim concave four-point sparkle, long vertical points and slightly shorter horizontal points, pointed ends, tiny compact white-hot center fading into pale warm gold #fff1c2 at edges. Clean luminous shape with a VERY small soft translucent edge, no large cloudy halo. It must read as one crisp simple glint when shown at 16 or 24 pixels on navy #2a2647. Center exactly on square canvas, star occupies about 72 percent canvas, ample transparent margin. REAL transparent RGBA background. No additional stars, no circles, no rings, no particles, no lens-flare streaks, no face, no text, no ground or backdrop, no baked checkerboard. Premium gentle tactile toy effects palette, soft white and pale gold only.
```


#### wax_chips_attempt2

- Tool: `tools.image_gen__imagegen`
- Date: 2026-11-22
- Source: `art/src/t4_wax_chips_attempt2.png`
- Status: adopted
- References: `assets/art/src/t4_wax_chips_attempt1.png`

```text
Use case: background-extraction. Edit the supplied THREE pink curved wax shell fragments sprite sheet. Preserve the three objects exactly: their pink glossy material, white broken edge rims, curved thin forms, arrangement, size, orientations, highlights and shading on the OBJECTS.
REMOVE ALL surrounding gray-white haze and background between and outside the fragments. Absolutely clean REAL transparent RGBA background, alpha zero everywhere outside the three hard physical silhouettes, no glow, no shadows, no floor, no mist, no light bloom, no checkerboard art. Retain only the physical pink fragments and their thin white rims. No detached specks. Bottom-right quadrant must be fully transparent. Three separated clean alpha cutouts, each entirely inside its existing quadrant. No text or labels.
```

