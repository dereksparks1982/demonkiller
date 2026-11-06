#!/usr/bin/env python3
"""Split the owner's original two-row crystal master, retaining its exact designs."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'assets' / 'art' / 'crystals'
SOURCE = FOLDER / 'Glowing and Dull Pixel Crystals.png'
COLORS = ('gold', 'silver', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink')

def split():
    with Image.open(SOURCE) as opened:
        src = opened.convert('RGBA')
    if src.size != (1774, 887):
        raise ValueError(f'Unexpected approved source dimensions {src.size}; refusing guessed extraction')
    outputs=[]
    for column,color in enumerate(COLORS):
        for state,top in (('bright',198),('dim',475)):
            if color == 'silver' and state == 'dim':
                continue
            center_x = round(99.5 + column * 172.3)
            crop = src.crop((center_x-75,top,center_x+75,top+230))
            small = crop.resize((15,23), Image.Resampling.NEAREST)
            small.putdata([(r,g,b,255 if a>=128 else 0) for r,g,b,a in small.getdata()])
            canvas = Image.new('RGBA',(32,32),(0,0,0,0))
            canvas.paste(small,(8,4))
            name=('crystal_silver_depleted.png' if color=='silver' else f'crystal_{color}_{state}.png')
            canvas.save(FOLDER/name,optimize=True)
            outputs.append(name)
    assert len(outputs)==19
    print('Extracted',len(outputs),'approved game-sized crystal sprites.')
if __name__=='__main__':
    split()
