/* Demon Killer imported dungeon art runtime.
 * 0x72 original Dungeon Tileset v5, 0x72 Dungeon Tileset II v1.7,
 * and both Pixel_Poem dungeon and enemy animation packs.
 * All source asset and author records: docs/third-party-dungeon-art.md
 */
(function(root){
  'use strict';
  const entries=Object.freeze({
    ...(root.DKFirstDungeonAssets?.entries||{}),
    ...(root.DKImportedDungeonAssets?.entries||{})
  });
  const AUTO=Object.freeze({
    auto_ox72i:{label:'AUTOMATIC WALL · 0x72 ORIGINAL',pack:'ox72i'},
    auto_ox72ii:{label:'AUTOMATIC WALL · 0x72 DUNGEON II',pack:'ox72'}
  });
  const images={};
  const pathFor=e=>e.pack==='ox72i'?
    './assets/art/dkarchitect/imported/ox72-first-game-atlas.png':
    './assets/art/dkarchitect/imported/dk-imported-game-atlas.png';
  function imageFor(e){
    if(typeof Image==='undefined')return null;
    const src=pathFor(e);
    if(!Object.hasOwn(images,src)){
      const img=new Image();
      img.src=src;
      images[src]=img;
    }
    const image=images[src];
    return image.complete&&image.naturalWidth?image:null;
  }
  function draw(g,id,x,y,w,h,t=0,frameOverride=null){
    const e=entries[id];
    if(!e||!e.frames.length||typeof g.drawImage!=='function')return false;
    const image=imageFor(e);if(!image)return false;
    const frameIndex=frameOverride===null&&e.fps?
      Math.floor(t*e.fps)%e.frames.length:frameOverride||0;
    const f=e.frames[frameIndex%e.frames.length];
    g.drawImage(image,f[0],f[1],f[2],f[3],x,y,w,h);
    return true;
  }
  function category(kind){
    return Object.entries(entries).filter(([,e])=>e.category===kind);
  }
  function footprint(id,rotation=0){
    const e=entries[id];
    if(!e)return [1,1];
    const [w,h]=e.footprint;
    return rotation%2?[h,w]:[w,h];
  }
  function drawObject(g,o,time){
    const e=entries[o.assetId];if(!e)return false;
    const [bw,bh]=footprint(o.assetId,o.r);
    const cx=(o.x+bw/2)*32,cy=(o.y+bh/2)*32;
    g.save();g.translate(cx,cy);g.rotate((o.r||0)*Math.PI/2);
    const painted=draw(g,o.assetId,-e.width/2,-e.height/2,e.width,e.height,time);
    g.restore();
    return painted;
  }
  function drawAutoFirst(g,px,py,{n,e,s,w},time){
    draw(g,'ox72i_wall_center',px,py,32,32,time,0);
    // The artist's own walls are layered in the intended base/outer/face system.
    if(!s)draw(g,'ox72i_wall_front',px,py,32,32,time,0);
    if(!n)draw(g,'ox72i_wall_outer_n',px,py,32,32,time,0);
    if(!w)draw(g,'ox72i_wall_outer_w',px,py,32,32,time,0);
    if(!e)draw(g,'ox72i_wall_outer_e',px,py,32,32,time,0);
    if(!n&&!w)draw(g,'ox72i_wall_outer_nw',px,py,32,32,time,0);
    if(!n&&!e)draw(g,'ox72i_wall_outer_ne',px,py,32,32,time,0);
    if(!s&&!w)draw(g,'ox72i_wall_outer_sw',px,py,32,32,time,0);
    if(!s&&!e)draw(g,'ox72i_wall_outer_se',px,py,32,32,time,0);
    if(!s&&!w)draw(g,'ox72i_wall_front_left',px,py,32,32,time,0);
    if(!s&&!e)draw(g,'ox72i_wall_front_right',px,py,32,32,time,0);
    return true;
  }
  function drawAutoSecond(g,px,py,{n,e,s,w},time){
    let id='ox72_wall_mid';
    if(!n)id=!w?'ox72_wall_top_left':!e?'ox72_wall_top_right':'ox72_wall_top_mid';
    else if(!s)id=!w?'ox72_wall_outer_front_left':!e?'ox72_wall_outer_front_right':'ox72_wall_mid';
    else if(!w)id='ox72_wall_left';
    else if(!e)id='ox72_wall_right';
    return draw(g,id,px,py,32,32,time,0);
  }
  function drawWall(g,scene,x,y,time=0){
    const width=scene.width||16,height=scene.height||16;
    const k=y*width+x,custom=scene.wallVariants?.[k],e=entries[custom];
    if(e&&e.category==='wall'){
      const turn=scene.wallRotations?.[k]||0;
      if(!turn)return draw(g,custom,x*32,y*32,32,32,time);
      g.save();g.translate(x*32+16,y*32+16);g.rotate(turn*Math.PI/2);
      const painted=draw(g,custom,-16,-16,32,32,time);
      g.restore();return painted;
    }
    const pack=scene.wallPacks?.[k]==='ox72'?'ox72':'ox72i';
    const on=(tx,ty)=>tx>=0&&ty>=0&&tx<width&&ty<height&&
      scene.walls[ty*width+tx]&&(scene.wallPacks?.[ty*width+tx]||'ox72i')===pack;
    const nearby={n:!!on(x,y-1),e:!!on(x+1,y),s:!!on(x,y+1),w:!!on(x-1,y)};
    return pack==='ox72'?drawAutoSecond(g,x*32,y*32,nearby,time):
      drawAutoFirst(g,x*32,y*32,nearby,time);
  }
  function animatedScene(scene){
    return scene.objects?.some(o=>o.type==='imported'&&entries[o.assetId]?.fps)
      ||scene.floorArt?.some(id=>id&&entries[id]?.fps)
      ||scene.wallVariants?.some(id=>id&&entries[id]?.fps);
  }
  root.DKArchitectDungeon=Object.freeze({
    entries,auto:AUTO,category,draw,drawWall,drawObject,footprint,animatedScene
  });
})(globalThis);
