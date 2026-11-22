"""Readable selections from the mandatory analyzer's unmodified contact sheet."""
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parents[2] / 'research/v03/audio'
files = sorted(folder.glob('*.wav'))
sheet = Image.open(folder / '_spectrograms.png')
selected = [i for i, file in enumerate(files) if 'scenario' in file.name or
            ('grain' not in file.name and file.stem.endswith('_01'))]
focus = Image.new('RGB', (1100, len(selected) * 70), (18, 18, 30))
for row, index in enumerate(selected):
    focus.paste(sheet.crop((0, index * 70, 1100, index * 70 + 70)), (0, row * 70))
focus.save(folder / '_focus_spectrograms.png')
print(folder / '_focus_spectrograms.png')
