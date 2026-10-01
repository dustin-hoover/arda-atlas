import json, sys
import numpy as np
from PIL import Image, ImageDraw
exec(open('warp.py').read().split("res=T(src)")[0])
G=json.load(open('geo.json'))
warp = len(sys.argv)<3 or sys.argv[2]!='raw'
im=Image.open('ct.png').convert('RGB'); im=Image.blend(im,Image.new('RGB',im.size,'white'),0.45)
d=ImageDraw.Draw(im)
def P(pts):
    m=np.asarray(pts,float); m=T(m) if warp else m
    return [tuple(p) for p in to_px(m)]
O=json.load(open('coast_out.json'))
for poly in [O['coast']]+O['islands']:
    m=np.asarray(poly+[poly[0]],float); d.line([tuple(p) for p in to_px(m)],fill=(0,170,0),width=3)
for r in G['RIVERS']: d.line(P(r['pts']),fill=(0,90,255),width=3)
for r in G['RANGES']: d.line(P(r['pts']),fill=(170,90,0),width=4)
for r in G['FORESTS']: d.line(P(r['pts']+[r['pts'][0]]),fill=(0,120,60),width=2)
for r in G['LAKES']: d.line(P(r['pts']+[r['pts'][0]]),fill=(0,200,255),width=3)
for p in G['PLACES']:
    x,y=P([[p[2],p[3]]])[0]; d.ellipse([x-4,y-4,x+4,y+4],fill=(255,0,200))
out=sys.argv[3] if len(sys.argv)>3 else 'overlay.png'
im.resize((im.width//2,im.height//2)).save(out)
