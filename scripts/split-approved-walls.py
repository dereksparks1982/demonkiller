#!/usr/bin/env python3
"""Cut the owner's approved temple wall atlas into original 32px tiles.
The original uploaded atlas is never modified. No new shapes are drawn.
"""
from pathlib import Path
from PIL import Image

ATLAS=Path("assets/art/temple/walls/Dungeon Temple Wall Tile Atlas(1).png")
OUT=ATLAS.parent
FINISHES=("clean","moss","cracked","broken")
FACES=("north","east","south","west")
HORIZ=[(14,164,201,242),(218,164,401,242),(417,164,603,242),(618,164,794,242)]
VERT=[(840,160,896,334),(924,160,977,334),(1003,160,1057,332),(1082,160,1135,334)]
CORNERS_L=[(14,362,90,453),(108,362,183,451),(201,362,278,451),(295,363,368,451)]
CORNERS_R=[(409,363,483,451),(498,363,573,449),(591,363,666,449),(682,363,758,451)]
TEES=[(12,481,137,595),(151,481,277,595),(294,481,415,595),(432,481,534,594)]
ENDS=[(17,624,72,735),(88,624,144,736),(160,624,215,736),(231,625,282,736)]
POSTS=[(33,12,122,131),(158,12,248,131),(282,12,371,131),(405,12,500,131)]

def tile(source,rect,portion="full"):
    x0,y0,x1,y1=rect
    if portion=="horizontal":
        middle=(x0+x1)//2
        width=min((x1-x0)//2,y1-y0)
        rect=(middle-width//2,y0,middle-width//2+width,y1)
    elif portion=="vertical":
        height=min(y1-y0,(x1-x0)*2)
        middle=(y0+y1)//2
        rect=(x0,middle-height//2,x1,middle-height//2+height)
    image=source.crop(rect)
    image.thumbnail((30,30),Image.Resampling.NEAREST)
    canvas=Image.new("RGBA",(32,32),(0,0,0,0))
    canvas.alpha_composite(image,((32-image.width)//2,(32-image.height)//2))
    return canvas

def turn(image,angle):
    return image.rotate(angle,Image.Resampling.NEAREST,expand=False)

def main():
    source=Image.open(ATLAS).convert("RGBA")
    if source.size!=(1536,1024):
        raise ValueError("Unexpected wall atlas dimensions; cannot safely extract")
    paths=[]
    for i,finish in enumerate(FINISHES):
        horizontal=tile(source,HORIZ[i],"horizontal")
        vertical=tile(source,VERT[i],"vertical")
        left=tile(source,CORNERS_L[i])
        right=tile(source,CORNERS_R[i])
        tee=tile(source,TEES[i])
        end=tile(source,ENDS[i])
        post=tile(source,POSTS[i])
        shapes={
            "straight":(horizontal,vertical,turn(horizontal,180),turn(vertical,180)),
            "corner":(left,right,turn(left,180),turn(right,180)),
            "t":(tee,turn(tee,270),turn(tee,180),turn(tee,90)),
            "cross":(post,post,post,post),
            "end":(end,turn(end,270),turn(end,180),turn(end,90)),
        }
        for shape,views in shapes.items():
            for face,image in zip(FACES,views):
                suffix="" if finish=="clean" else "_"+finish
                name=f"wall_{shape}_{face}{suffix}.png"
                image.save(OUT/name,optimize=True)
                paths.append(name)
    assert len(paths)==80
    print("Extracted 80 approved wall tiles from original repo atlas: 5 shapes × 4 faces × 4 finishes.")

if __name__=="__main__":
    main()
