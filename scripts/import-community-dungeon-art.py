#!/usr/bin/env python3
"""Import approved, freely downloadable 0x72 + Pixel_Poem art as DK GAME atlases.
No original Pixel_Poem ZIP, raw Aseprite project or standalone source-pack
sprites are published; the graphics are packed for use IN the game only.
Uses the owner's exact v1.7/v2.0/animation archive SHA-256 identities.
"""
from pathlib import Path
from PIL import Image
import requests,re,html,zipfile,io,collections,math,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/art/dkarchitect/imported"
INPUT=ROOT/".dk-import-source"
EXPECTED={
"0x72_DungeonTilesetII_v1.7.zip":"a5b23341ebc831d7798bfb9666d864a08c079bb7aed18e3cf023a27d517c1512",
"2D Pixel Dungeon Asset Pack v2.0.zip":"efb5711728cd031b14d1333ad71329d2622bf9f11853a7cb7d216326e1d33f9d",
"Enemy_Animations_Set.zip":"4e17a982f71f688de7c86c9fa5feb63ad2709c649281b62b46cf6ce3de900dcd",
"doc.png":"2bb0c93615ac1a9c99e0f32be98d2d8e48fa78d7c4449627b3980dc9a849276e",
"pumpkin_dude.png":"85d180f0a42d3a0bbcf14c1bce08d6b77bea6217013a73aa0235f8c9f8efdf17"
}
HOSTS={
"https://0x72.itch.io/dungeontileset-ii":["0x72_DungeonTilesetII_v1.7.zip","doc.png","pumpkin_dude.png"],
"https://pixel-poem.itch.io/dungeon-assetpuck":["2D Pixel Dungeon Asset Pack v2.0.zip","Enemy_Animations_Set.zip"]
}
def download(page,names):
    session=requests.Session()
    agent={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/159.0"}
    r=session.get(page,headers=agent,timeout=35);r.raise_for_status()
    match=re.search(r'csrf_token" value="([^"]+)',r.text)
    if not match:raise RuntimeError("itch.io did not supply a download CSRF token at "+page)
    csrf=match.group(1)
    ids=re.findall(r'data-upload_id="(\d+)',r.text)
    body={"csrf_token":csrf}
    if ids:body["upload_id"]=ids[0]
    xhr={**agent,"X-Requested-With":"XMLHttpRequest","Referer":page}
    rr=session.post(page+"/download_url",data=body,headers=xhr,timeout=35);rr.raise_for_status()
    dlpage=rr.json().get("url")
    if not dlpage:raise RuntimeError("itch.io free download link unavailable: "+page)
    rr=session.get(dlpage,headers=agent,timeout=35);rr.raise_for_status()
    newcsrf=re.search(r'csrf_token" value="([^"]+)',rr.text)
    token=newcsrf.group(1) if newcsrf else csrf
    # Game download HTML pairs each file name with its creator upload ID.
    infos=re.findall(r'<a[^>]*data-upload_id="(\d+)"[^>]*>[\s\S]*?<strong[^>]*class="name"[^>]*>([^<]+)</strong>',rr.text)
    uploads={html.unescape(label.strip()):upload_id for upload_id,label in infos}
    if not uploads:raise RuntimeError("No named itch.io uploads were found for "+page)
    for name in names:
        match=next((uid for label,uid in uploads.items() if name in label),None)
        if not match:raise RuntimeError("Required free upload not listed: "+name+"; available "+str(list(uploads)))
        resp=session.post(page+"/file/"+match,data={"csrf_token":token},headers={**xhr,"Referer":dlpage},timeout=35);resp.raise_for_status()
        cdn=resp.json().get("url")
        if not cdn:raise RuntimeError("Missing download CDN URL for "+name)
        binary=session.get(cdn,headers=agent,timeout=90);binary.raise_for_status()
        raw=binary.content
        if hashlib.sha256(raw).hexdigest()!=EXPECTED[name]:raise RuntimeError("Creator upload differs from owner-approved "+name)
        (INPUT/name).write_bytes(raw)
        print("Verified creator asset:",name,len(raw))
def kind(pack,name):
    q=name.lower()
    if pack=="ox72":
        if q.startswith(("wall_","column_wall")):return "wall"
        if q.startswith(("floor_","edge_")):return "floor"
        if q.startswith(("doors_","door_")):return "structure"
        if q.startswith(("weapon_","flask_","coin_","key_","scroll_","bomb_","potion_")):return "items"
        if any(k in q for k in ("_idle","_run","_hit","_death")) or (q.endswith("_anim") and any(k in q for k in ("zombie","slug","imp","goblin","chort","orc","demon","wogol","knight","dwarf","elf","wizzard","ogre","swampy","skelet","angel","necromancer","lizard"))):return "npcs"
        return "furniture"
    if q.startswith("enemies-") or "character_animation" in q or "dungeon_character" in q:return "npcs"
    if "interface" in q:return "items"
    if "item" in q:return "items"
    if "trap" in q:return "furniture"
    if q.startswith("pixelpoem_tile_"):
        i=int(q.split("_")[-1]);x=i%10;y=i//10
        return "floor" if 1<=x<=8 and 2<=y<=5 else "wall"
    return "furniture"
def read():
    parts=collections.defaultdict(list);counts=collections.Counter()
    for pack,name in (("ox72","0x72_DungeonTilesetII_v1.7.zip"),("pixelpoem","2D Pixel Dungeon Asset Pack v2.0.zip"),("enemy","Enemy_Animations_Set.zip")):
        with zipfile.ZipFile(INPUT/name) as z:
            for filepath in z.namelist():
                if filepath.startswith("__MACOSX/") or not filepath.endswith(".png"):continue
                rel="/".join(filepath.replace("\\","/").split("/")[1:])
                if not rel or rel.endswith(("demonstration.png","Dungeon_Tileset_at.png")):continue
                im=Image.open(io.BytesIO(z.read(filepath))).convert("RGBA")
                if pack=="ox72":
                    if not rel.startswith("frames/"):continue
                    stem=Path(rel).stem
                    match=re.search(r'_anim_f(\d+)$',stem)
                    key="ox72_"+(stem[:match.start()]+"_anim" if match else stem)
                    parts[key].append((int(match.group(1)) if match else 0,im,kind(pack,stem),stem));counts[pack]+=1
                elif pack=="pixelpoem":
                    if rel.endswith("Dungeon_Tileset.png"):
                        if im.size!=(160,160):raise RuntimeError("Dungeon tileset dimensions changed")
                        for cy in range(10):
                            for cx in range(10):
                                key="pixelpoem_tile_"+str(cy*10+cx).zfill(2)
                                parts[key].append((0,im.crop((cx*16,cy*16,cx*16+16,cy*16+16)),kind(pack,key),key));counts["tile_cells"]+=1
                        continue
                    if rel.endswith(("Dungeon_Character.png","Dungeon_Character_2.png")):
                        for cy in range(0,im.height,16):
                            for cx in range(0,im.width,16):
                                part=im.crop((cx,cy,cx+16,cy+16))
                                if not part.getchannel("A").getbbox():continue
                                key="pixelpoem_"+Path(rel).stem.lower()+"_"+str(cx//16)+"_"+str(cy//16)
                                parts[key].append((0,part,"npcs",key));counts["characters"]+=1
                        continue
                    stem=Path(rel).stem
                    match=re.search(r'[_-](\d+)$',stem)
                    n=int(match.group(1)) if match else 0
                    key="pixelpoem_"+re.sub(r'[^a-z0-9_]+','_',rel.rsplit(".",1)[0].lower())
                    if match:key=re.sub(r'[_-]\d+$','',key)
                    parts[key].append((n,im,kind(pack,rel),stem));counts[pack]+=1
                else:
                    stem=Path(rel).stem
                    if im.height!=32 or im.width%32:raise RuntimeError("Unexpected Enemy Animation dimension "+rel)
                    for frame in range(im.width//32):
                        parts["pixelpoem_"+stem].append((frame,im.crop((32*frame,0,32*(frame+1),32)),"npcs",stem));counts[pack]+=1
    for name in ("doc.png","pumpkin_dude.png"):
        im=Image.open(INPUT/name).convert("RGBA")
        if im.size!=(128,32):raise RuntimeError("Special 0x72 character sheet changed: "+name)
        for frame in range(4):
            key="ox72_"+name[:-4]
            parts[key].append((frame,im.crop((32*frame,0,32*(frame+1),32)),"npcs",key));counts["special"]+=1
    return parts,counts
def pack(parts):
    width=1024;locations={};x=0;y=0;row_h=0
    for key,values in sorted(parts.items()):
        for frame,im,*_ in sorted(values,key=lambda v:v[0]):
            w,h=im.size
            if x+w+1>width:y+=row_h+1;x=0;row_h=0
            locations[(key,frame)]=(x,y)
            x+=w+1;row_h=max(row_h,h)
    atlas=Image.new("RGBA",(width,y+row_h),(0,0,0,0));catalog={}
    for key,values in sorted(parts.items()):
        frames=[]
        for frame,im,category,label in sorted(values,key=lambda v:v[0]):
            px,py=locations[(key,frame)]
            atlas.paste(im,(px,py),im)
            frames.append([px,py,im.width,im.height])
        scale=1 if key.startswith(("pixelpoem_enemies-","ox72_doc","ox72_pumpkin_dude")) else 2
        sw=max(v[2] for v in frames)*scale;sh=max(v[3] for v in frames)*scale
        catalog[key]={
            "name":label.replace("_"," ").replace("-"," ").title(),"pack":"ox72" if key.startswith("ox72_") else "pixelpoem",
            "category":category,"frames":frames,"fps":7 if len(frames)>1 else 0,
            "width":sw,"height":sh,"footprint":[max(1,math.ceil(sw/32)),max(1,math.ceil(sh/32))]
        }
    return atlas,catalog
def main():
    INPUT.mkdir(exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    for page,names in HOSTS.items():download(page,names)
    parts,counts=read()
    atlas,entries=pack(parts)
    if len(entries)<375 or sum(len(v["frames"]) for v in entries.values())<850:
        raise RuntimeError("Incomplete bundle contents: "+str(len(entries)))
    atlas.save(OUT/"dk-imported-game-atlas.png",optimize=True)
    data={"schema":1,"atlas":"./assets/art/dkarchitect/imported/dk-imported-game-atlas.png","entries":entries}
    (OUT/"catalog.js").write_text("/* 0x72 CC0 and Pixel_Poem game-use art index; see docs/third-party-dungeon-art.md */\n"+
        "globalThis.DKImportedDungeonAssets="+json.dumps(data,separators=(",",":"))+";\n")
    (OUT/"manifest.json").write_text(json.dumps(data,indent=2)+"\n")
    print("DK integrated art:",len(entries),"sprite groups; frame totals:",sum(len(v["frames"]) for v in entries.values()),"source frames:",dict(counts))
if __name__=="__main__":main()
