"""Build the two public distributions from one runtime payload."""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import re

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "release-build"
html = (ROOT / "studio.html").read_text(encoding="utf8")
# Public entry accepts the language preference only. Research entry stays intact.
bootstrap = """<script>
    const launchUrl = new URL(location.href);
    for (const key of [...launchUrl.searchParams.keys()]) {
      if (key !== 'lang') launchUrl.searchParams.delete(key);
    }
    if (launchUrl.href !== location.href) history.replaceState(null, '', launchUrl);
  </script>"""
html = html.replace('<meta name="robots" content="noindex,nofollow">', bootstrap)
html = html.replace('<script defer src="studio/sound/assets.js"></script>', '')
files = {"index.html": html.encode("utf8")}
paths = re.findall(r'(?:<script defer src|<link rel="stylesheet" href)="([^"]+)"', html)
heroes = "slasher crusher caster spinner roller".split()
materials = "wax jelly soap chalk sand sponge beadslime kohaku".split()
paths.extend(f"studio/art/{hero}-portrait.webp" for hero in heroes)
for material in materials:
    paths.extend([f"studio/art/worlds/{material}.js", f"studio/art/worlds/{material}-thumb.webp"])
for name in paths:
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT) or path.suffix not in (".js", ".css", ".webp"):
        raise ValueError(name)
    files[name] = path.read_bytes()

digest = sha256()
for name, data in sorted(files.items()):
    digest.update(name.encode() + b"\0" + sha256(data).digest())
destination = OUTPUT / digest.hexdigest()[:16]
OUTPUT.mkdir(exist_ok=True)
archive = "asmr-musou-v1.5-html5.zip"
with TemporaryDirectory(dir=OUTPUT) as scratch:
    build = Path(scratch) / "build"
    pages = build / "pages"
    pages.mkdir(parents=True)
    with ZipFile(build / archive, "w") as bundle:
        for name, data in sorted(files.items()):
            path = pages / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            bundle.writestr(ZipInfo(name), data, compress_type=ZIP_DEFLATED)
    if destination.exists():
        prior = {p.relative_to(destination) for p in destination.rglob("*") if p.is_file()}
        current = {p.relative_to(build) for p in build.rglob("*") if p.is_file()}
        if prior != current or any((destination / p).read_bytes() != (build / p).read_bytes() for p in current):
            raise RuntimeError(f"Existing output differs: {destination}")
    else:
        build.rename(destination)
print(destination)
