#!/usr/bin/env python3
"""Split the owner's DK stone wall sheet into 106 transparent original-art PNGs.
Only the 32px material swatches are certified as seamless. Every large decorative
wall section is a freely placeable footprint, NOT an auto-joining 32px tile.
"""
from __future__ import annotations
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

SOURCE=Path("assets/art/temple/Demon Killer Stone Wall Tileset.png")
OUT=Path("assets/art/dkarchitect/walls")
SOURCE_SHA256="204ccc88f97f9246de3096bf341bd3f7f8142179525cb1bce16822b191204def"
BANDS=((0,131),(131,271),(271,355),(355,485),(485,612),(612,739),(739,879),(879,1024))
GROUPS=("structures","corners","straight","mossy","ruins","curves","pillars","fortified")
COUNTS=(12,11,11,12,14,12,19,15)
FINISHES=("clean","dirty","moss","cracked","broken")

def bands_of_columns(occupied):
    runs=[]
    start=None
    for x,on in enumerate(occupied):
        if on and start is None:start=x
        if not on and start is not None:runs.append([start,x-1]);start=None
    if start is not None:runs.append([start,len(occupied)-1])
    merged=[]
    for lo,hi in runs:
        if merged and lo-merged[-1][1]<=10:merged[-1][1]=hi
        else:merged.append([lo,hi])
    return merged

def isolate(source):
    alpha=source.getchannel("A").load()
    pieces={}
    for (top,bottom),group,count in zip(BANDS,GROUPS,COUNTS):
        occupied=[]
        for x in range(source.width):
            seen=0
            for y in range(top,bottom):
                if alpha[x,y]>80:
                    seen+=1
                    if seen>=5:break
            occupied.append(seen>=5)
        columns=bands_of_columns(occupied)
        if len(columns)!=count:raise ValueError(f"{group}: wanted {count} pieces, found {len(columns)}")
        for number,(lo,hi) in enumerate(columns,1):
            sx=max(0,lo-3);ex=min(source.width,hi+4)
            part=source.crop((sx,top,ex,bottom)).convert("RGBA")
            pix=part.load()
            for y in range(part.height):
                for x in range(part.width):
                    if pix[x,y][3]<=80:pix[x,y]=(0,0,0,0)
            bound=part.getchannel("A").getbbox()
            if not bound:raise ValueError(f"Empty {group} #{number}")
            part=part.crop(bound)
            name=f"dk_wall_{group}_{number:02d}"
            part.save(OUT/(name+".png"),optimize=True)
            pw,ph=part.size;rw,rh=round(pw*.5),round(ph*.5)
            pieces[name]={
                "label":group.rstrip("s").capitalize()+" "+str(number).zfill(2),
                "category":group,"width":pw,"height":ph,
                "renderWidth":rw,"renderHeight":rh,
                "w":math.ceil(rw/32),"h":math.ceil(rh/32),
                "safeToAutotile":False,"filename":name+".png",
                "sourceRect":[sx+bound[0],top+bound[1],pw,ph]
            }
    if len(pieces)!=106:raise ValueError("Expected 106 separate wall objects")
    return pieces

def grid_stones(source):
    """Five 32px wall-brush materials sampled from the original masonry art.
    Exact opposite-edge RGB/alpha equality prevents transparent tile seams."""
    sample=source.crop((365,287,397,319)).convert("RGBA")
    raw=list(sample.getdata())
    if not all(px[3]>200 for px in raw):raise ValueError("Opaque stone sample required")
    for finish in FINISHES:
        image=Image.new("RGBA",(32,32))
        p=image.load()
        for y in range(32):
            for x in range(32):
                r,g,b,_=raw[y*32+x]
                if finish=="dirty":r,g,b=int(r*.78),int(g*.74),int(b*.70)
                elif finish=="moss" and (x*5+y*7)%19<7:
                    r,g,b=int(r*.67),int(g*.86),int(b*.56)
                elif finish=="cracked":r,g,b=int(r*.87),int(g*.86),int(b*.88)
                elif finish=="broken":r,g,b=int(r*.73),int(g*.70),int(b*.67)
                p[x,y]=(r,g,b,255)
        for y in range(32):
            c=tuple((p[0,y][i]+p[31,y][i])//2 for i in range(3))+(255,)
            p[0,y]=p[31,y]=c
        for x in range(32):
            c=tuple((p[x,0][i]+p[x,31][i])//2 for i in range(3))+(255,)
            p[x,0]=p[x,31]=c
        corner=tuple(sum(p[x,y][i] for x,y in ((0,0),(0,31),(31,0),(31,31)))//4 for i in range(3))+(255,)
        for x,y in ((0,0),(0,31),(31,0),(31,31)):p[x,y]=corner
        assert all(p[0,y]==p[31,y] for y in range(32))
        assert all(p[x,0]==p[x,31] for x in range(32))
        image.save(OUT/("grid_wall_"+finish+".png"),optimize=True)

def main():
    raw=SOURCE.read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    if sha!=SOURCE_SHA256:raise ValueError("The owner-uploaded wall master changed; review required")
    sheet=Image.open(SOURCE).convert("RGBA")
    if sheet.size!=(1536,1024):raise ValueError("Expected 1536x1024 wall master")
    OUT.mkdir(parents=True,exist_ok=True)
    pieces=isolate(sheet)
    grid_stones(sheet)
    manifest={
        "schema":1,"source":str(SOURCE),"source_sha256":sha,"source_scale":.5,
        "piece_count":len(pieces),"pieces":pieces,"grid_finishes":list(FINISHES),
        "notice":"Only the grid stones are seam-safe autotiles. The 106 original-image cutouts are individual building components."
    }
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    (OUT/"catalog.js").write_text(
        "/* Individual transparent owner-approved DK wall pieces. Automatically extracted, not regenerated. */\n"+
        "globalThis.DemonKillerArchitectWallCatalog = Object.freeze("+
        json.dumps(pieces,separators=(",",":"))+");\n",encoding="utf-8")
    print("Extracted 106 separate transparent approved sprites plus 5 seam-tested stone swatches")

if __name__=="__main__":
    main()
