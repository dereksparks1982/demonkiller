#!/usr/bin/env python3
"""Recreate the 32px top-down DK wall set without a background or captions."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, math
T=32
DIRECTIONS=('north','east','south','west')
FINISHES=('clean','dirty','moss','cracked','broken')
SHAPES=('straight','corner','t','cross','end','pillar','arch','window','buttress','ruin','curve')
CONNECTIONS={
'straight':((0,1,0,1),(1,0,1,0),(0,1,0,1),(1,0,1,0)),
'corner':((1,1,0,0),(0,1,1,0),(0,0,1,1),(1,0,0,1)),
't':((0,1,1,1),(1,0,1,1),(1,1,0,1),(1,1,1,0)),
'cross':((1,1,1,1),)*4,
'end':((1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,0,1)),
'pillar':((0,0,0,0),)*4,
'arch':((0,1,0,1),(1,0,1,0),(0,1,0,1),(1,0,1,0)),
'window':((0,1,0,1),(1,0,1,0),(0,1,0,1),(1,0,1,0)),
'buttress':((0,1,0,1),(1,0,1,0),(0,1,0,1),(1,0,1,0)),
'ruin':((1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,0,1)),
'curve':((1,1,0,0),(0,1,1,0),(0,0,1,1),(1,0,0,1)),
}
MORTAR=(24,27,23);SHADOW=(36,37,31);BRIGHT=(153,145,120);MOSS=(63,83,47)
def blend(a,b,f):return tuple(max(0,min(255,round(x*(1-f)+y*f))) for x,y in zip(a,b))
def rnd(x,y,key):
 h=2166136261
 for c in f'{x}:{y}:{key}':h=((h^ord(c))*16777619)&0xffffffff
 return h
def geometry(shape,face):
 n,e,s,w=CONNECTIONS[shape][DIRECTIONS.index(face)]
 a=[[False]*T for _ in range(T)]
 for y in range(T):
  for x in range(T):
   center=10<=x<=21 and 10<=y<=21
   arms=(n and 10<=x<=21 and y<=15) or (s and 10<=x<=21 and y>=16) or (e and 10<=y<=21 and x>=16) or (w and 10<=y<=21 and x<=15)
   a[y][x]=bool(center or arms)
 if shape=='pillar':
  a=[[(x-15.5)**2+(y-15.5)**2<=10.7**2 for x in range(T)] for y in range(T)]
 if shape=='buttress':
  for y in range(8,24):
   for x in range(10,22):a[y][x]=True
 if shape=='curve':
  cx,cy=((16,16) if face=='north' else (15,16) if face=='east' else (15,15) if face=='south' else (16,15))
  for y in range(3,29):
   for x in range(3,29):
    if a[y][x] and not (9<=x<=22 and 9<=y<=22) and (x-cx)**2+(y-cy)**2>17.2**2:a[y][x]=False
 return a
def stone(x,y,style,shape,face):
 course=y//5;offset=4 if course%2 else 0
 if (x+offset)%8==0 or y%5==0:return MORTAR
 k=rnd((x+offset)//8,y//5,'stone')
 shade=((k>>3)%19)-9
 base=(75,65,55) if style=='dirty' else (98,95,77)
 c=tuple(max(0,min(255,v+shade)) for v in base)
 if style in ('moss','broken') and rnd(x//3,y//3,'moss'+shape+face)%11<=2:
  return (92,112,63) if rnd(x,y,'l')%4==0 else MOSS
 if style=='dirty' and rnd(x//3,y//3,'grit')%7<=2:c=blend(c,(52,47,42),.35)
 if style=='cracked' and rnd(x//2,y//2,'crack')%23==0:c=blend(c,(40,39,34),.45)
 if (x+y)%13==0:c=blend(c,BRIGHT,.28)
 return c
def tile(shape,face,style):
 mask=geometry(shape,face)
 im=Image.new('RGBA',(T,T),(0,0,0,0));px=im.load()
 for y in range(T):
  for x in range(T):
   if not mask[y][x]:continue
   c=stone(x,y,style,shape,face)
   if y>0 and not mask[y-1][x]:c=blend(c,BRIGHT,.68)
   if x>0 and not mask[y][x-1]:c=blend(c,BRIGHT,.35)
   if x<T-1 and not mask[y][x+1]:c=blend(c,SHADOW,.54)
   if y<T-1 and not mask[y+1][x]:c=blend(c,(18,21,19),.73)
   px[x,y]=(*c,255)
 d=ImageDraw.Draw(im)
 if shape=='pillar':
  d.ellipse((8,8,23,23),outline=(27,29,23,255),width=2)
  d.line((11,10,17,9),fill=(169,161,134,255),width=1)
  d.ellipse((13,13,18,18),fill=(69,71,59,255))
 elif shape=='window':
  if face in ('north','south'):
   d.rectangle((13,12,19,19),fill=(17,19,18,255));d.line((16,13,16,19),fill=(115,109,91,255))
  else:
   d.rectangle((12,13,19,19),fill=(17,19,18,255));d.line((13,16,19,16),fill=(115,109,91,255))
 elif shape=='arch':
  d.arc((10,9,21,24),180,360,fill=(169,156,126,255),width=2)
  d.line((12,15,12,22),fill=(32,32,26,255));d.line((19,15,19,22),fill=(32,32,26,255))
 elif shape=='buttress':
  d.rectangle((11,11,20,20),outline=(26,29,25,255),width=2)
  d.line((13,12,18,12),fill=(181,171,144,255))
 if style in ('cracked','broken') or shape=='ruin':
  d.line(((14,12),(16,15),(15,17),(18,19)),fill=(22,22,19,255))
  d.line(((16,15),(19,14),(20,12)),fill=(38,37,33,255))
 if style=='broken' or shape=='ruin':
  for x,y in ((12,13),(20,16),(13,21)):d.rectangle((x,y,x+1,y+1),fill=(0,0,0,0))
  for x,y in ((7,25),(25,24),(23,27)):d.rectangle((x,y,x+1,y+1),fill=(64,62,49,255))
 return im
def check_edges(images):
 # All arm endpoints have an identical 12px opaque footprint, including moss,
 # broken, corner and curved variants. This is pixel-level, not visual guessing.
 for (shape,face,finish),im in images.items():
  n,e,s,w=CONNECTIONS[shape][DIRECTIONS.index(face)]
  a=im.getchannel('A')
  if n:assert tuple(a.getpixel((x,0))>0 for x in range(T))==tuple(10<=x<=21 for x in range(T))
  if s:assert tuple(a.getpixel((x,T-1))>0 for x in range(T))==tuple(10<=x<=21 for x in range(T))
  if w:assert tuple(a.getpixel((0,y))>0 for y in range(T))==tuple(10<=y<=21 for y in range(T))
  if e:assert tuple(a.getpixel((T-1,y))>0 for y in range(T))==tuple(10<=y<=21 for y in range(T))
def main():
 out=Path(__file__).resolve().parents[1]/'assets/art/temple/walls'
 out.mkdir(parents=True,exist_ok=True)
 sprites={};names=[]
 for shape in SHAPES:
  for face in DIRECTIONS:
   for finish in FINISHES:
    im=tile(shape,face,finish)
    sprites[(shape,face,finish)]=im
    name='wall_'+shape+'_'+face+('' if finish=='clean' else '_'+finish)+'.png'
    im.save(out/name,optimize=True);names.append((shape,face,finish,name))
 check_edges(sprites)
 atlas=Image.new('RGBA',(20*T,math.ceil(len(names)/20)*T),(0,0,0,0))
 for i,(shape,face,finish,name) in enumerate(names):atlas.paste(sprites[(shape,face,finish)],((i%20)*T,(i//20)*T))
 atlas.save(out/'Demon_Killer_Orthographic_Seamless_Wall_Atlas.png',optimize=True)
 data={'tile_size':32,'camera':'orthographic_topdown','transparent':True,'tile_count':len(names),'shapes':SHAPES,'directions':DIRECTIONS,'finishes':FINISHES,'connections':CONNECTIONS,'note':'Exact 12px cardinal connector profiles; roof/wall collision remains existing room grid. No UI art.'}
 (out/'wall-ortho-manifest.json').write_text(json.dumps(data,indent=2)+'\n')
 print('Verified transparent top-down wall atlas and',len(names),'individual sprites')
if __name__=='__main__':main()
