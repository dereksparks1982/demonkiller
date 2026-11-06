#!/usr/bin/env python3
"""Non-mutating diagnostic of the approved owner-uploaded wall atlas."""
from PIL import Image
from collections import Counter
from pathlib import Path
p=Path('assets/art/temple/walls/Dungeon Temple Wall Tile Atlas(1).png')
im=Image.open(p).convert('RGBA')
w,h=im.size
print('APPROVED-WALL-ATLAS SIZE',w,h)
import base64, io
# Emit a compact indexed-colour thumbnail of the original atlas for inspection.
# This is encoded in job logs only and does not alter the approved source.
preview=im.resize((768,512),Image.Resampling.NEAREST).convert('RGB').quantize(colors=96)
buf=io.BytesIO()
preview.save(buf,format='PNG',optimize=True)
print('ATLAS_PREVIEW_BASE64_BEGIN')
print(base64.b64encode(buf.getvalue()).decode())
print('ATLAS_PREVIEW_BASE64_END')
print('MODE',im.mode)
colors=Counter(im.getdata())
print('TOP COLORS',colors.most_common(16))
print('ALPHA PIXELS',Counter(a for r,g,b,a in im.getdata()).most_common(12))
# Each cell shows dominant sampled color family of wall art/background.
# No edits to art, walls, or game behavior.
lookup=[((0,0,0),' '),((255,255,255),'W')]
def char(rgb):
 r,g,b,a=rgb
 if a < 80: return ' '
 v=(max(r,g,b)+min(r,g,b))//2
 if r>g*1.32 and r>b*1.32: return 'R'
 if g>r*1.35 and g>b*1.25: return 'G'
 if b>r*1.35 and b>g*1.25: return 'B'
 return ' .:-=+*#%@'[min(9,v*10//256)]
dw,dh=64,52
sm=im.resize((dw,dh),Image.Resampling.BOX)
print('64x52 SAMPLED ART MAP:')
for y in range(dh):
 print(str(y).zfill(2)+' '+''.join(char(sm.getpixel((x,y))) for x in range(dw)))
# Row and column activity of alpha and luminance against main corner pixel:
bg=im.getpixel((0,0))
def different(c):
 if c[3] < 100: return False
 return (sum(abs(c[i]-bg[i]) for i in range(3))>60) or (c[3]!=bg[3])
for axis in (0,1):
 n=w if axis==0 else h
 other=h if axis==0 else w
 scores=[]
 for v in range(n):
  count=0
  for z in range(0,other,max(1,other//64)):
   pt=(v,z) if axis==0 else (z,v)
   count+=different(im.getpixel(pt))
  scores.append(count)
 runs=[]
 active=False
 for idx,v in enumerate(scores+[0]):
  on=v>=4
  if on and not active: start=idx
  if active and not on and idx-start>=5: runs.append((start,idx-1,max(scores[start:idx])))
  active=on
 print('AXIS',axis,'activity-runs',runs[:120])
