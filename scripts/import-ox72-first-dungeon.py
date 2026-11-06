#!/usr/bin/env python3
"""One-time import of 0x72's ORIGINAL 16x16 Dungeon Tileset v5.
Collects the official free source upload, compares it against both identical
owner-provided archives, and publishes 243 sprites in a compact game atlas.
Do not publish the original ZIP or any extra third-party software.
"""
from pathlib import Path
from PIL import Image
import collections,importlib.util,io,hashlib,json,math,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
SOURCE="0x72_16x16DungeonTileset.v5.zip"
HASH="4749333cf50b35c025d889bc9ae63e61b101c5f1d226ce742bdc6106a01cf984"
OUT=ROOT/"assets/art/dkarchitect/imported"
CACHE=ROOT/".dk-import-source"
def obtain():
    spec=importlib.util.spec_from_file_location("dk_asset_fetch",ROOT/"scripts/import-community-dungeon-art.py")
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.EXPECTED[SOURCE]=HASH
    mod.download("https://0x72.itch.io/16x16-dungeon-tileset",[SOURCE])
    path=CACHE/SOURCE
    if hashlib.sha256(path.read_bytes()).hexdigest()!=HASH:raise RuntimeError("Creator file mismatches the two user uploads")
    return path
def group(name):
    s=name.lower()
    if s.startswith(("wall_","edge_")):return "wall"
    if s.startswith(("floor_","pit_","stairs_","darkness_")):return "floor"
    if s.startswith(("door_","column")):return "structure"
    if s.startswith(("npc_","monster_")):return "npcs"
    if s.startswith(("weapon_","waepon_","flask_","hand_","coin_","key_")):return "items"
    return "furniture"
def main():
    CACHE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    archive=obtain()
    sprites={}
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if "__MACOSX" in name or not name.lower().endswith(".png") or "/items/" not in name:continue
            stem=Path(name).stem.lower()
            key="ox72i_"+re.sub("[^a-z0-9_]+","_",stem)
            if key in sprites:raise RuntimeError("Duplicate item name: "+key)
            im=Image.open(io.BytesIO(z.read(name))).convert("RGBA")
            sprites[key]=(im,stem,group(stem))
    if len(sprites)!=243:raise RuntimeError(f"Unexpected v5 file count: {len(sprites)}")
    width=1024;locations={};x=y=rowh=0
    for key,(im,_,_) in sorted(sprites.items()):
        w,h=im.size
        if x+w+1>width:y+=rowh+1;x=0;rowh=0
        locations[key]=(x,y)
        x+=w+1;rowh=max(rowh,h)
    atlas=Image.new("RGBA",(width,y+rowh),(0,0,0,0))
    catalog={}
    for key,(im,stem,cat) in sorted(sprites.items()):
        left,top=locations[key]
        atlas.paste(im,(left,top),im)
        sw,sh=im.width*2,im.height*2
        catalog[key]={
            "name":stem.replace("_"," ").title(),
            "pack":"ox72i","category":cat,
            "frames":[[left,top,im.width,im.height]],
            "fps":0,"width":sw,"height":sh,
            "footprint":[max(1,math.ceil(sw/32)),max(1,math.ceil(sh/32))]
        }
    atlas.save(OUT/"ox72-first-game-atlas.png",optimize=True)
    data={"schema":1,"source":"https://0x72.itch.io/16x16-dungeon-tileset","sha256":HASH,
      "atlas":"./assets/art/dkarchitect/imported/ox72-first-game-atlas.png",
      "entries":catalog}
    (OUT/"first-catalog.js").write_text("/* 0x72 original Dungeon Tileset v5 game assets; CC0, artist 0x72. */\n"+
      "globalThis.DKFirstDungeonAssets="+json.dumps(data,separators=(",",":"))+";\n")
    (OUT/"first-manifest.json").write_text(json.dumps(data,indent=2)+"\n")
    print("Imported 0x72 original Dungeon Tileset v5:",len(catalog),"independent items")
if __name__=="__main__":main()
