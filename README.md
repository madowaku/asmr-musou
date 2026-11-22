# ci/pages-build — Cloudflare Pages build helper

This branch holds only the build script used by the Cloudflare Pages project for ASMR MUSOU.
It shares no history with the game branches and is never deployed itself.

`build-site.sh <checkout> <out>` copies only the files needed to run the game / soundboard / lab / lab-audio
from whichever branch is being built, adds `robots.txt` + `_headers` (noindex, nosniff, no-referrer) and a small
`play.html` launcher. Docs, tasks, raw art sources, research logs, tests, tools and `.git` are never published.

Pages build command (set in the Pages project, not in the game branches):

```
(git fetch -q --depth=1 origin ci/pages-build && git show FETCH_HEAD:build-site.sh || curl -fsSL https://raw.githubusercontent.com/madowaku/asmr-musou/ci/pages-build/build-site.sh) > /tmp/build-site.sh && sh /tmp/build-site.sh . dist
```

Output directory: `dist`. Production branch: `main` (stable). Preview branches: `feat/v0.2-tactile` (dev),
`research/v0.3-materials` (research).
