from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[2]
data=(root/'lab/outlines.js').read_text(encoding='utf-8').split('window.LAB.outlines = ')[1].split(';')[0]
report={}
for key,meta in json.loads(data).items():
    im=Image.open(root/f'assets/v03/body/{key}.png');alpha=np.array(im)[:,:,3]
    mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(u*im.width,v*im.height) for u,v in meta['points']],fill=255)
    opaque=alpha>=250;coverage=np.count_nonzero(opaque&(np.array(mask)>0))/np.count_nonzero(opaque)
    assert coverage>=.95,(key,coverage)
    derived=Image.open(root/f'assets/v03/bundle/body/{key}.png');assert derived.size==(256,256)
    report[key]=round(float(coverage),6)
print('Original opaque pixel coverage:',json.dumps(report))
