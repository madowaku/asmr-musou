# ASMR MUSOU enemy art / T2

制作日: 2026-11-22。担当範囲: `assets/art/` とこの `assets/ART_LOG.md` のみ。

## 制作結果

組み込み `image_gen`（実行ツール名 `tools.image_gen__imagegen`）で、1ファイルにつき1回、合計10回生成。10案を採用、棄却0、再生成0。別料金の外部API、APIキー、CLI画像生成、コードで描いた代替キャラは使用していない。アカウント側の利用枠や課金額はこのツールから確認できない。

全10点は384×384のRGBA PNG。原画像はすべて1254×1254のRGBA PNGで、`art/src/` に無変更コピーした。元の生成先とコピーのSHA-256一致を確認。各原画像は完全透明な背景を持っていたので、今回クロマキーは不要。生成時の低アルファの孤立点と外周ノイズのみ後処理した。

| Final file | Attempts | Decision | Source |
|---|---:|---|---|
| `art/wax_0.png` | 1 | adopted | `art/src/wax_0_attempt1.png` |
| `art/wax_1.png` | 1 | adopted | `art/src/wax_1_attempt1.png` |
| `art/wax_2.png` | 1 | adopted | `art/src/wax_2_attempt1.png` |
| `art/bubble_0.png` | 1 | adopted | `art/src/bubble_0_attempt1.png` |
| `art/jelly_0.png` | 1 | adopted | `art/src/jelly_0_attempt1.png` |
| `art/ice_0.png` | 1 | adopted | `art/src/ice_0_attempt1.png` |
| `art/boss_0.png` | 1 | adopted | `art/src/boss_0_attempt1.png` |
| `art/ice_1.png` | 1 | adopted | `art/src/ice_1_attempt1.png` |
| `art/boss_1.png` | 1 | adopted | `art/src/boss_1_attempt1.png` |
| `art/boss_2.png` | 1 | adopted | `art/src/boss_2_attempt1.png` |

## 後処理と再現方法

`art/tools/key_bg.py` はPython/Pillow/numpyによる透明背景処理。実際の採用画像では元のアルファを保持し、alpha >= 16の中央本体と連結しない点を除去。原寸で2 pxだけ外周マットを内側へ寄せ、0.35 pxのソフトマットを適用して縁の混色を除去した。キャラクターの絵や顔はコードで描画・改変していない。

WAX 3枚、ICE 2枚、BOSS 3枚は各無傷版の本体中心を固定し、同じグループで共通の切り出し範囲・拡大率を使用。単独画像も本体中心で配置。約6%の余白を設け、premultiplied alphaでLanczos縮小し、384×384に保存。丸い本体の中心がキャンバス中心になる配置で、顔を基準に別々にトリミングしていない。残るalpha < 2と完全透明部分の隠れたRGBをゼロ化した。

同スクリプトには、将来必要な場合の緑 / マゼンタ背景用ソフトクロママットと逆合成によるdespillも用意。これは今回の採用画像に使用しておらず、任意の半透明物体の正確な透過率を復元するものではない。

再生成を伴わずに成果物を再構築・検査:

```powershell
python -B assets/art/tools/build_art.py
```

単体の背景処理例:

```powershell
python -B assets/art/tools/key_bg.py assets/art/src/wax_0_attempt1.png assets/art/wax_0_preview.png
# 必要な場合のみ: --key 00FF00 または --key FF00FF
```

単体コマンドはファミリー共通の位置合わせを行わないため、正式な10枚の再構築にはbuild_art.pyを使う。

## 検証と目視確認

- Python検査: 10/10 PASS。PNG / RGBA / 384×384、四隅のalphaはすべて0、外周全辺も完全透明。
- 約6%の余白: 実際の非ゼロalpha境界は最短21–26 px前後。補間による低アルファ端を含む。
- `art/verification.json`: ファイルサイズ、原画像と成果物のSHA-256、処理条件、境界、四隅の検査結果。
- `art/contact_sheet.png`: 全10枚を384 pxと80 pxで配置。背景は指定の#2a2647。ファイル内の各表示は実寸。閲覧アプリの自動縮小とは区別する。
- `art/contact_sheet_80.png`: 80 pxのみを並べた追加の確認用シート。
- 両シートを自分で目視。全顔の2眼と笑顔を80 pxで識別でき、色縁、矩形の背景、孤立した破片、接地影は見られなかった。全体の上左照明、顔の色と形、輪郭に黒い線を使わない方針が揃っている。
- 補助的な暗紫色の顔ピクセル重心比較: 同一ファミリー内の最大ずれは384 pxで約0.56 px（BOSS）。80 px換算で約0.12 px。WAX/ICEはそれより小さい。これは同一キャラ差分の位置合わせの補助検査であり、目視確認も行った。
- ゲームへの組み込み、ゲーム内スクリーンショット、Android実機、人間の試遊は今回の作業範囲外であり、検証済みとはしていない。

残る弱点: WAXの最も細い白ヒビは80 pxだと控えめ。BUBBLE/JELLY/露出コアの透明感は主に生成画像の光学的な陰影表現であり、内部の大半のalphaは約252–254/255、強く背景が透ける素材ではない。反射・屈折は静止画に焼き込まれている。殻の有無とBOSSの3段階は80 pxでも判別できる。再生成が必要な不読顔・色縁・スタイル不整合は今回のシート確認では見つからなかった。

## 利用条件の理解（全10ファイルに適用）

生成ツールはOpenAIの組み込みimage_gen。正確な内部モデル名やユーザーの契約プランはツールから確認できない。以下は2026-11-22に参照した公開規約についての理解で、個別契約・適用地域を確認した法的判断ではない。

OpenAIとの関係では、法律が認める範囲でユーザーが出力を所有するという公開規約の記載に基づき、このゲームへの組み込み・加工・配布（商用利用を含む）を想定して制作した。出力の独自性、著作権成立、第三者権利の非侵害を保証するものではない。他のユーザーに似た出力が生成される可能性がある。利用者は適用法・OpenAIの規約とポリシーに従う必要がある。CC0やストック素材ライセンスだとは扱っていない。画像はAI生成であり、人が描いた原画とは表示しない。[OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)

ビジネス向け契約には別の契約が適用される場合があるため、実際の契約による条件の差異は未確認。[OpenAI Services Agreement](https://openai.com/policies/services-agreement/)

既存キャラクターや外部の参考画像は投入していない。参照画像はすべて今回自分で生成したWAX、ICE、BOSSのみ。

## 文書の指示と今回の範囲

`CODEX_TASK_ART.md` は「5種」「game.jsへの組み込み」「ASSETS.md更新」「前後のゲーム画面」を指示するが、今回の明示的なT2依頼は「状態差分込み10枚」「ASSETS ONLY」「game.js/style.css/index.html/tests/を触らない」「記録はassets/ART_LOG.md」「コミットしない」。新しいT2指示を優先した。`ORCHESTRATOR_BRIEF.md` のP2/P5にある統合作業・広いドキュメント更新・コミットも担当していない。仕様やゲームルールのコードへの合わせ込みは行っていない。

## 個別生成記録と正確なプロンプト

以下は実際にツールへ渡したプロンプト全文。参照画像の役割とパスも記録。機械可読版は `art/generation_manifest.json`。

### wax_0.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: round strawberry toy, thin glossy shell lip, readable face.
- References: none (new generation).
- Raw source: `art/src/wax_0_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: stylized-concept. Make ONE separate square 1024x1024 production enemy sprite for ASMR MUSOU, asset wax_0.
Subject: a tactile toy / squishy collectible: perfectly round strawberry-pink squishy ball covered by a THIN HARD glossy pastel-pink candy-wax shell, like a wax-coated sweet. Intact state. At the lower-right edge a subtle tiny seam/lip reveals that the shell is very thin, never a thick rim. No cracks or missing chunks.
Shared style: premium soft 2.5D toy product render, glossy macro material, bright pastel, soft studio key light from UPPER LEFT, simple clean readable silhouette with no ink outline. Front three-quarter view, full body, no limbs. Face centered on front: exactly two small dark plum oval eyes and one small dark plum U-shaped smile, no nose, eyebrows or cheeks; bold enough to read when the whole sprite is only 80 pixels. Each eye about 3.5 percent of body diameter, smile about 10 percent wide, eyes separated by about 24 percent of body diameter.
Composition: single character centered; circular body center exactly at image center. Body occupies about 76 percent of square canvas, generous empty margin on ALL sides. Nothing detached outside silhouette.
Background: REAL transparent RGBA background, clean alpha cutout, no checkerboard graphic, NO ground shadow, NO floor, NO backdrop, no scenery. If true transparent output cannot be made, use ONLY a perfectly flat solid pure #00FF00 chroma-green background with no gradient and no green reflection on toy. Do not render checkerboard.
No text, logos, watermark, border, extra objects, existing character likeness.
```

### wax_1.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: registered fine white fracture web; at 80 px the finest hairlines are deliberately subtle.
- References: `art/src/wax_0_attempt1.png`.
- Raw source: `art/src/wax_1_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: precise-object-edit. ONE separate square production sprite for ASMR MUSOU. Image 1 is the EDIT TARGET, the approved wax_0 character. Preserve its round body silhouette, exact centered body position and diameter, framing, strawberry-pink hue, two dark plum oval eyes and small U-shaped smile, face position, front three-quarter camera, soft UPPER-LEFT studio light, toy product macro material, crisp unoutlined edge. No limbs or detached flying debris. Full body with generous empty margins. Preserve real transparent RGBA background; no ground shadow, no floor, scenery, text, logos, watermark, checkerboard or other objects.
Change ONLY shell damage: the same thin hard glossy candy-wax shell now has a connected web of fine WHITE fracture lines over its surface. Several irregular polygonal cracks, clearly readable at 80px without overwhelming the face. The shell still completely covers the soft interior; no missing shell yet. Keep face entirely unobscured. Exactly the same silhouette and pose as reference.
```

### wax_2.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: large thin-shell gaps reveal matte pink interior; face preserved.
- References: `art/src/wax_0_attempt1.png`.
- Raw source: `art/src/wax_2_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: precise-object-edit. ONE separate square production sprite for ASMR MUSOU. Image 1 is the EDIT TARGET, the approved wax_0 character. Preserve its round body silhouette, exact centered body position and diameter, framing, strawberry-pink hue, two dark plum oval eyes and small U-shaped smile, face position, front three-quarter camera, soft UPPER-LEFT studio light, toy product macro material, crisp unoutlined edge. No limbs or detached flying debris. Full body with generous empty margins. Preserve real transparent RGBA background; no ground shadow, no floor, scenery, text, logos, watermark, checkerboard or other objects.
Change ONLY shell damage: about HALF of the thin glossy candy-wax shell has broken away. Several BIG shell flakes are missing from upper-right and left side, revealing large areas of soft MATTE strawberry-pink squishy interior bulging gently through the gaps. Remaining shell is thin, with visibly wafer-thin broken edges, curled slightly at fracture edges. Face remains intact on the central front patch. Fragments stay attached, nothing scattered around. Keep the overall circular body diameter and center exactly the same as reference; bulges remain within original outline envelope. Make the matte interior / glossy shell material contrast unmistakable at 80px.
```

### bubble_0.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: central face cell plus seven surrounding cells, mint palette, clear bubble material cue.
- References: `art/src/wax_0_attempt1.png`.
- Raw source: `art/src/bubble_0_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: stylized-concept. ONE individual square 1024x1024 production enemy sprite for ASMR MUSOU. Image 1 is a STYLE REFERENCE ONLY: match its tactile squishy toy collectible rendering, soft studio key light from UPPER LEFT, glossy macro material, bright pastel, clean edge with no ink outline, tiny cute face of exactly two dark plum oval eyes and small dark plum U-shaped smile. Face must stay clearly readable at 80px. Similar relative eye size and spacing, no eyebrows, nose or cheeks. Front three-quarter view, centered full body, no limbs. Single simple readable silhouette filling about 76 percent of canvas, generous empty margin on every side, body center at image center. Real transparent RGBA background, no checkerboard artwork; no ground shadow, floor, scenery, text, logos, watermark, frame, extra objects, existing character likeness. Subject: MINT-GREEN bubble-wrap blob made of approximately EIGHT distinct plump clear inflated bubble-wrap CELLS fused in a compact round cluster, one slightly larger central cell with the tiny face on it, seven surrounding cells, about eight cells total, no tiny bead details. Soft mint-tinted transparent material, glossy curved cell highlights, clear subtle seams between puffy cells, delicately wobbly squishy form. Only one face on central cell. Keep dark facial features crisp against pale mint. If actual transparent output is impossible, use perfectly uniform pure #FF00FF background without any magenta bounce light.
```

### jelly_0.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: lavender squat droplet, soft lobed base, readable face. Translucency is mainly rendered shading, not strong through-body alpha.
- References: `art/src/wax_0_attempt1.png`.
- Raw source: `art/src/jelly_0_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: stylized-concept. ONE individual square 1024x1024 production enemy sprite for ASMR MUSOU. Image 1 is a STYLE REFERENCE ONLY: match its tactile squishy toy collectible rendering, soft studio key light from UPPER LEFT, glossy macro material, bright pastel, clean edge with no ink outline, tiny cute face of exactly two dark plum oval eyes and small dark plum U-shaped smile. Face must stay clearly readable at 80px. Similar relative eye size and spacing, no eyebrows, nose or cheeks. Front three-quarter view, centered full body, no limbs. Single simple readable silhouette filling about 76 percent of canvas, generous empty margin on every side, body center at image center. Real transparent RGBA background, no checkerboard artwork; no ground shadow, floor, scenery, text, logos, watermark, frame, extra objects, existing character likeness. Subject: a LAVENDER translucent wobbly JELLY DROP, slightly squat with a gently tapered domed peak and softly lobed bottom, like a squishy jelly collectible. Simple single droplet silhouette, no limbs or detached droplets. Glossy moist surface, soft translucent lavender interior, gentle internal light refraction without complicated sparkle details. One tiny dark plum face in middle of body. Material reads as jelly, NOT opaque plastic. If actual transparent output is impossible, use perfectly uniform pure #00FF00 background without any green bounce light.
```

### ice_0.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: angular icy-blue gem with internal frost.
- References: `art/src/wax_0_attempt1.png`.
- Raw source: `art/src/ice_0_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: stylized-concept. ONE individual square 1024x1024 production enemy sprite for ASMR MUSOU. Image 1 is a STYLE REFERENCE ONLY, not the character shape or color: match its tactile squishy toy collectible rendering, soft studio key light from UPPER LEFT, glossy macro materials, bright pastel, clean edge with no ink outline. Match the face style: exactly two dark plum oval eyes and a small dark plum U-shaped smile, bold enough to read at 80px; no eyebrows, nose or cheeks. Front three-quarter view, centered full body, no limbs. Single simple readable silhouette filling about 76 percent of canvas, generous empty margin on every side, circular body center at image center. Real transparent RGBA background with clean smooth alpha edges, no colored fringe, no checkerboard artwork. No ground shadow, floor, scenery, text, logos, watermark, frame, extra objects, existing character likeness. Subject: ICY-BLUE faceted ICE-CANDY CRYSTAL creature, an angular chunky gem silhouette, with flat polygonal faces and ice-blue translucent material with a little milky INTERNAL FROST. Broad flat front facet holds the simple tiny cute face. Squat chunky irregular hexagonal gem, width and height similar, not a ball and not a spiky star. About 7-9 broad clean facets, upper-left white glossy reflection, cyan-blue refracted side facets, soft frozen internal gradients. Intact, NO fracture lines yet. Keep overall face size like reference. If true transparent output is impossible, use ONLY pure uniform #FF00FF backdrop with no magenta reflection.
```

### boss_0.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: golden-peach round form with three visibly thick stepped shell layers.
- References: `art/src/wax_0_attempt1.png`.
- Raw source: `art/src/boss_0_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: stylized-concept. ONE individual square 1024x1024 production enemy sprite for ASMR MUSOU. Image 1 is a STYLE REFERENCE ONLY, not the character shape or color: match its tactile squishy toy collectible rendering, soft studio key light from UPPER LEFT, glossy macro materials, bright pastel, clean edge with no ink outline. Match the face style: exactly two dark plum oval eyes and a small dark plum U-shaped smile, bold enough to read at 80px; no eyebrows, nose or cheeks. Front three-quarter view, centered full body, no limbs. Single simple readable silhouette filling about 76 percent of canvas, generous empty margin on every side, circular body center at image center. Real transparent RGBA background with clean smooth alpha edges, no colored fringe, no checkerboard artwork. No ground shadow, floor, scenery, text, logos, watermark, frame, extra objects, existing character likeness. Subject: BOSS, a large GOLDEN-PEACH round squishy sphere wrapped in a visibly THICK MULTI-LAYER WAX SHELL. Intact state, no cracks. On the right and lower-right curved perimeter, show a tidy stepped shell lip exposing THREE distinct concentric coating layers like an onion: outer golden-apricot, middle pale peach, inner pale pink. These are smooth manufactured shell edges, not damage and not decorative stripes. Thick rounded layered coating contrasts clearly with thin wax in reference. Large friendly round body, front face stays smooth and simple. Keep the circular body centered; whole outline roughly round without crown, limbs or accessories. Face uses same dark plum eyes and smile. If true transparent output is impossible, use ONLY pure uniform #00FF00 backdrop with no green reflection.
```

### ice_1.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: sharp white branching fractures distinguish the damaged state at 80 px.
- References: `art/src/ice_0_attempt1.png`.
- Raw source: `art/src/ice_1_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: precise-object-edit. ONE separate square production sprite for ASMR MUSOU. Image 1 is the EDIT TARGET. Keep the SAME character identity, camera, full body position, exact outer silhouette scale and center, face position and size, dark plum oval eyes and small U smile, soft UPPER-LEFT studio light, glossy macro toy collectible finish, no ink outline. Generous empty margin on all sides, no limbs, no loose debris. Real transparent RGBA background with clean alpha edges, no fringe, no ground shadow, no floor, no checkerboard, scenery, text, logos, watermark, accessories or other objects. Change ONLY the ice damage state: the same icy-blue angular faceted ice-candy gem now has SHARP WHITE FRACTURE LINES inside and across the crystal. Three or four bold branching fracture paths crossing upper and side facets, with finer branching hairlines, recognizable at 80px. Fractures are distinct from the intact facet boundaries. Keep central eyes and mouth entirely unobscured, same internal frost and blue refraction as reference. No missing chunks, same exact polygonal outer silhouette and framing.
```

### boss_1.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: broad missing outer-shell areas expose the peach layer; thick broken edges and cracks.
- References: `art/src/boss_0_attempt1.png`.
- Raw source: `art/src/boss_1_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: precise-object-edit. ONE separate square production sprite for ASMR MUSOU. Image 1 is the EDIT TARGET. Keep the SAME character identity, camera, full body position, exact outer silhouette scale and center, face position and size, dark plum oval eyes and small U smile, soft UPPER-LEFT studio light, glossy macro toy collectible finish, no ink outline. Generous empty margin on all sides, no limbs, no loose debris. Real transparent RGBA background with clean alpha edges, no fringe, no ground shadow, no floor, no checkerboard, scenery, text, logos, watermark, accessories or other objects. Change ONLY the golden-peach multi-layer boss shell damage state: the thick GOLDEN outer shell has shattered and peeled away in a few LARGE chunks, revealing a substantial smooth PALE PEACH second wax layer beneath. Remaining golden outer shell plates have a few strong white cracks. Show visible THICK stepped broken shell edges, like broken layered wax, obviously thicker than a thin candy coating. The lowest pink inner layer remains visible at the right-bottom rim. Keep the friendly face exactly in place and readable on the smooth center. No flying or detached pieces. Same round body diameter and centered outline envelope as reference. The damaged state must read as partly peeled golden shell over peach wax, not a completely naked jelly yet.
```

### boss_2.png

- Tool: `undefined`
- Date: undefined
- Attempts: 1; adopted 1 / rejected 0; regeneration 0.
- Decision: Adopted: shell-free peach-pink jelly core with subtle bulge; happy face.
- References: `art/src/boss_0_attempt1.png`.
- Raw source: `art/src/boss_2_attempt1.png`.
- Post-processing: Native alpha retained; connected subject cleanup at alpha>=16; 2px source edge inset and 0.35px soft matte; shared framing per damage family; 6% nominal margin; premultiplied-alpha Lanczos resize to 384x384; clear alpha<2 and hidden RGB.
- Usage terms: 上記「利用条件の理解」を適用。OpenAI出力として利用を想定、独自性・著作権成立・非侵害および個別契約条件は保証/確認していない。

Exact prompt:

```text
Use case: precise-object-edit. ONE separate square production sprite for ASMR MUSOU. Image 1 is the EDIT TARGET. Keep the SAME character identity, camera, full body position, exact outer silhouette scale and center, face position and size, dark plum oval eyes and small U smile, soft UPPER-LEFT studio light, glossy macro toy collectible finish, no ink outline. Generous empty margin on all sides, no limbs, no loose debris. Real transparent RGBA background with clean alpha edges, no fringe, no ground shadow, no floor, no checkerboard, scenery, text, logos, watermark, accessories or other objects. Change ONLY the multi-layer boss to its final exposed-core state: ALL wax shell layers are GONE, zero remaining rind or shell rings. A single GLOSSY SOFT PEACH-PINK JELLY CORE is fully exposed, slightly bulging and subtly wobbly, with same round overall outline, center, scale and face position as reference. Gently peach-tinted pink, visually distinct from strawberry-pink regular wax enemy. Smooth clear jelly gloss and gentle translucent internal light, soft rounded material with one slight squishy bulge inside the same silhouette envelope, no large bottom puddle. The face is HAPPY, same two plum oval eyes and small U smile, marginally more cheerful but same size. Keep upper-left highlight and dark edge shading consistent.
```


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

