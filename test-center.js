/* Demon Killer / DK Architect, experimental standalone test center.
 * Copyright (c) DK Softworks. Procedural pixel artwork is original to this prototype.
 * No Godot runtime, external assets, third-party sprites, or production game-save keys.
 */
(function () {
  'use strict';
  const N = 16, TILE = 32, COUNT = N * N;
  const AREA = 'dk.temple.sacrifice.001';
  const STORE = 'dkSoftworks.demonkiller.testCenter.v1';
  // Named character records never replace the independent DK Architect room-save key.
  const CHARACTERS_STORE = 'dkSoftworks.demonkiller.characters.v1';
  const ACTIVE_STORE = 'dkSoftworks.demonkiller.activeCharacter.v1';
  const $ = id => document.getElementById(id);
  const canvas = $('room'), ctx = canvas.getContext('2d');
  if (!ctx) return;
  const FLOOR = {
    stone: { label: 'Ashen Flagstone', color: '#343039' },
    dark: { label: 'Obsidian Slab', color: '#25232d' },
    sigil: { label: 'Blood-Rune Tile', color: '#45313c' },
    cracked: { label: 'Cracked Stone', color: '#42414a' }
  };
  const CATALOG = {
    altar: { label: 'Sacrificial Altar', category: 'relics', w: 4, h: 2, solid: true },
    crystal: { label: 'Soul Crystal', category: 'relics', w: 1, h: 1, solid: false },
    braziers: { label: 'Crimson Brazier', category: 'relics', w: 1, h: 1, solid: true },
    runestone: { label: 'Runestone', category: 'relics', w: 1, h: 1, solid: true },
    pillar: { label: 'Ruined Pillar', category: 'structure', w: 1, h: 1, solid: true },
    door: { label: 'Iron Arch Door', category: 'structure', w: 1, h: 1, solid: false },
    statue: { label: 'Veiled Statue', category: 'structure', w: 1, h: 2, solid: true },
    pew: { label: 'Temple Pew', category: 'furniture', w: 2, h: 1, solid: true },
    coffin: { label: 'Stone Sarcophagus', category: 'furniture', w: 2, h: 1, solid: true },
    candle: { label: 'Candle Cluster', category: 'furniture', w: 1, h: 1, solid: false },
    chest: { label: 'Reliquary Chest', category: 'furniture', w: 1, h: 1, solid: true }
  };
  const GROUPS = { relics: 'Relics & Ritual', structure: 'Gothic Structure',
    furniture: 'Furniture & Props', floors: 'Stone Floors' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const index = (x, y) => y * N + x;
  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < N && y < N;
  const message = value => { $('status').textContent = value; };
  const baseSize = type => CATALOG[type] || { w: 1, h: 1 };
  const dims = o => {
    const a = baseSize(o.type);
    return (o.r || 0) % 2 ? [a.h, a.w] : [a.w, a.h];
  };
  function fresh() {
    const walls = Array(COUNT).fill(0);
    const floor = Array(COUNT).fill('stone');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x === 0 || y === 0 || x === N-1 || y === N-1) walls[index(x,y)] = 1;
      if ((x + y) % 7 === 0) floor[index(x,y)] = 'cracked';
      if (x >= 5 && x <= 10 && y >= 4 && y <= 9) floor[index(x,y)] = 'dark';
      if ((x === 7 || x === 8) && y >= 7 && y <= 10) floor[index(x,y)] = 'sigil';
    }
    walls[index(8,0)] = 0;
    return {
      schema: 1, area_id: AREA, tile_size: TILE, width: N, height: N,
      introSeen: false,
      floor, walls,
      objects: [
        { id:'temple_north_door', type:'door', x:8, y:0, r:0, open:true },
        { id:'sacrifice_altar', type:'altar', x:6, y:5, r:0 },
        { id:'soul_crystal', type:'crystal', x:8, y:9, r:0, spent:false },
        { id:'brazier_west', type:'braziers', x:4, y:4, r:0 },
        { id:'brazier_east', type:'braziers', x:11, y:4, r:0 },
        { id:'pillar_west', type:'pillar', x:3, y:2, r:0 },
        { id:'pillar_east', type:'pillar', x:12, y:2, r:0 },
        { id:'pew_west', type:'pew', x:3, y:10, r:0 },
        { id:'pew_east', type:'pew', x:11, y:10, r:0 },
        { id:'candle_near_altar', type:'candle', x:10, y:7, r:0 }
      ],
      spawn: { x:8, y:12 },
      player: { x:8, y:12, facing:'north', form:'ghost' }
    };
  }
  let scene = fresh(), mode = 'walk', tool = 'place', category = 'relics',
      current = 'crystal', selectedId = null, corner = null, hover = null,
      previewRotation = 0,
      dirty = false, loaded = false, undoStack = [], redoStack = [], serial = 0;
  const Cult=typeof DemonKillerCult!=='undefined'?DemonKillerCult:null;
  const Population=typeof DemonKillerPopulation!=='undefined'?DemonKillerPopulation:null;
  let cultWorld=null,populationWorld=null,cultNetworkView=null;
  let activeSlot = 0;
  try {
    const n = Number(localStorage.getItem(ACTIVE_STORE));
    if (Number.isInteger(n) && n >= 1 && n <= 3) activeSlot = n;
  } catch (error) { /* Allow direct offline temple use without storage. */ }
  const visual = { x:scene.player.x, y:scene.player.y, queue:[] };
  let rightMouseHeld = false, rightPointer = null, lastFrameTime = 0;
  let opening = null, ritual = null;
  const openingRoute = [
    [8,0],[8,1],[8,2],[8,3],[9,3],[10,3],[10,4],[10,5],[10,6],
    [10,7],[9,7],[8,7]
  ];
  const womanImages = {};
  if (typeof Image !== 'undefined') {
    for (const direction of ['north','east','south','west']) {
      const img = new Image();
      img.onload = () => draw();
      img.onerror = () => { /* Retain an original block-art fallback if unavailable. */ };
      img.src = './assets/art/characters/crystal-woman/crystal_woman_' + direction + '.png';
      womanImages[direction] = img;
    }
  }
  function startOpening() {
    opening = {
      x:8, y:-1, facing:'south', route:openingRoute.slice(), index:0,
      phase:'enter', pause:0
    };
    rightMouseHeld=false;resetVisual();
    message('A red-haired woman enters the Forsaken Temple. Wait until she leaves.');
  }
  function updateOpening(dt) {
    if (!opening) return;
    if (opening.phase === 'wait') {
      opening.pause-=dt;
      if (opening.pause<=0) {
        opening.phase='leave';
        opening.route=openingRoute.slice(0,-1).reverse().concat([[8,-1]]);
        opening.index=0;
      }
      return;
    }
    const point=opening.route[opening.index];
    if (!point) {
      if (opening.phase==='enter') {
        opening.phase='wait'; opening.pause=.95;opening.facing='north';
      } else {
        opening=null;scene.introSeen=true;dirty=true;persistCharacter();
        message('The woman is gone. You are alone with your body and the soul crystal.');
      }
      return;
    }
    const dx=point[0]-opening.x,dy=point[1]-opening.y,dist=Math.hypot(dx,dy);
    if (dist<.008) { opening.x=point[0];opening.y=point[1];opening.index++;return; }
    opening.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');
    const distance=Math.min(dist,3.5*dt);
    opening.x+=dx/dist*distance;opening.y+=dy/dist*distance;
  }
  function drawCorpse() {
    if (scene.player.form!=='ghost' || !scene.objects.some(o=>o.type==='altar')) return;
    const a=scene.objects.find(o=>o.type==='altar');
    if (!a) return;
    const xx=a.x*TILE,yy=a.y*TILE;
    // Primitive horizontal body, kept on the altar until resurrection.
    pixel(ctx,'#2c2228',xx+18,yy+25,92,14);
    pixel(ctx,'#d4aea0',xx+20,yy+25,13,13);
    pixel(ctx,'#3b2930',xx+19,yy+24,14,4);
    pixel(ctx,'#61404e',xx+34,yy+24,41,16);
    pixel(ctx,'#987781',xx+74,yy+27,28,5);
    pixel(ctx,'#3c323d',xx+101,yy+27,9,6);
  }
  function drawWoman() {
    if (!opening) return;
    const x=Math.round(opening.x*TILE),y=Math.round(opening.y*TILE);
    const img=womanImages[opening.facing];
    if (img && img.complete && img.naturalWidth>0) {
      ctx.drawImage(img,x,y,TILE,TILE);
    } else {
      // Same deliberately crude 32x32 color-block style as DK Architect.
      pixel(ctx,'#6a2727',x+8,y+2,16,11);
      pixel(ctx,'#ba4e2c',x+9,y+3,14,8);
      pixel(ctx,'#d4ac91',x+12,y+9,8,7);
      pixel(ctx,'#285740',x+9,y+16,14,12);
      pixel(ctx,'#1b3e2d',x+7,y+26,18,4);
    }
  }
  function beginResurrection() {
    const p=scene.player;
    rightMouseHeld=false;resetVisual();
    ritual={phase:'spirit',time:0,fromX:visual.x,fromY:visual.y,visual:{x:visual.x,y:visual.y}};
    message('The crystal answers. Your spirit moves toward the body on the altar.');
  }
  function updateResurrection(dt) {
    if (!ritual) return;
    ritual.time+=dt;
    if (ritual.phase==='spirit') {
      const t=Math.min(1,ritual.time/1.15),e=t*t*(3-2*t);
      ritual.visual.x=ritual.fromX+(8-ritual.fromX)*e;
      ritual.visual.y=ritual.fromY+(5.55-ritual.fromY)*e;
      if (t>=1) {
        scene.player.form='living';
        const crystal=scene.objects.find(o=>o.type==='crystal'&&!o.spent);
        if (crystal) crystal.spent=true;
        const landing=[[8,7],[9,7],[7,7],[8,8],[9,8],[7,8]].find(([x,y])=>canStand(x,y,'living'));
        if (landing) {scene.player.x=landing[0];scene.player.y=landing[1];}
        else {scene.player.x=scene.spawn.x;scene.player.y=scene.spawn.y;repairPlayer();}
        scene.player.facing='south';
        ritual.phase='rise';ritual.time=0;dirty=true;
      }
    } else {
      const t=Math.min(1,ritual.time/.55),e=t*t*(3-2*t);
      ritual.visual.x=8+(scene.player.x-8)*e;
      ritual.visual.y=5.55+(scene.player.y-5.55)*e;
      if(t>=1) {
        ritual=null;resetVisual();persistCharacter();
        message('Your spirit rejoins its restored body. Crystal energy has been absorbed.');
      }
    }
  }
  const resetVisual = () => {
    visual.x = scene.player.x; visual.y = scene.player.y; visual.queue.length = 0;
  };
  function characterRecord() {
    if (!activeSlot) return null;
    try {
      const data = JSON.parse(localStorage.getItem(CHARACTERS_STORE) || 'null');
      if (!data || data.version !== 1 || !Array.isArray(data.slots)) return null;
      const slot = data.slots[activeSlot-1];
      return slot && slot.id === activeSlot ? {data, slot} : null;
    } catch (error) { return null; }
  }
  function persistCharacter() {
    const record = characterRecord();
    if (!record) return;
    try {
      record.slot.scene = clone(scene);
      if(cultWorld)record.slot.cultWorld=clone(cultWorld);
      if(populationWorld)record.slot.populationWorld=clone(populationWorld);
      record.slot.updated = Date.now();
      localStorage.setItem(CHARACTERS_STORE, JSON.stringify(record.data));
    } catch (error) { message('Character save unavailable: ' + error.message); }
  }
  function restoreCharacter() {
    const record = characterRecord();
    if (!record || !record.slot.scene) return;
    try {
      scene = validate(record.slot.scene);
      if(!('introSeen' in scene))scene.introSeen=true;
      dirty = false; loaded = true; resetVisual();
      message('Welcome back, ' + record.slot.name + '. The Forsaken Temple is ready.');
    } catch (error) { message('Character record is invalid; starting in the original temple.'); }
  }
  function objectAt(x, y) {
    for (let i = scene.objects.length - 1; i >= 0; i--) {
      const o = scene.objects[i], d = dims(o);
      if (x >= o.x && y >= o.y && x < o.x + d[0] && y < o.y + d[1]) return o;
    }
    return null;
  }
  function objectAtId(id) { return scene.objects.find(o => o.id === id) || null; }
  function overlap(a, b) {
    const [aw,ah] = dims(a), [bw,bh] = dims(b);
    return a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah;
  }
  function canPlace(o, ignoreId = null) {
    const [w,h] = dims(o);
    if (!inside(o.x,o.y) || !inside(o.x+w-1,o.y+h-1)) return false;
    for (let y = o.y; y < o.y+h; y++) for (let x = o.x; x < o.x+w; x++) {
      if (scene.walls[index(x,y)]) return false;
      if (scene.player.form === 'living' && scene.player.x === x && scene.player.y === y) return false;
    }
    return !scene.objects.some(other => other.id !== ignoreId && overlap(o,other));
  }
  function canStand(x, y, form = scene.player.form) {
    if (!inside(x,y) || scene.walls[index(x,y)]) return false;
    if (form === 'ghost') return true;
    return !scene.objects.some(o => {
      if (!CATALOG[o.type].solid && !(o.type === 'door' && !o.open)) return false;
      const d = dims(o);
      return x >= o.x && x < o.x + d[0] && y >= o.y && y < o.y + d[1];
    });
  }
  function repairPlayer() {
    if (canStand(scene.player.x,scene.player.y)) return;
    if (canStand(scene.spawn.x,scene.spawn.y)) {
      scene.player.x = scene.spawn.x; scene.player.y = scene.spawn.y; return;
    }
    for (let y=1;y<N-1;y++) for (let x=1;x<N-1;x++) if (canStand(x,y)) {
      scene.player.x=x;scene.player.y=y; return;
    }
  }
  function transact(fn, success) {
    const before = clone(scene), old = JSON.stringify(before);
    fn();
    if (JSON.stringify(scene) === old) { message('No change: the selected coordinate is blocked or already has that value.'); return false; }
    undoStack.push(before); if (undoStack.length > 70) undoStack.shift();
    redoStack.length=0; dirty=true; repairPlayer(); resetVisual(); draw(); message(success); return true;
  }
  function undo() {
    if (!undoStack.length) return message('Nothing to undo.');
    redoStack.push(clone(scene)); scene=undoStack.pop();selectedId=null;corner=null;dirty=true;resetVisual();draw();
    message('Undid the last room change.');
  }
  function redo() {
    if (!redoStack.length) return message('Nothing to redo.');
    undoStack.push(clone(scene));scene=redoStack.pop();selectedId=null;corner=null;dirty=true;resetVisual();draw();
    message('Restored the last room change.');
  }
  function pixel(g,color,x,y,w,h) { g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  // Sprite sources are exclusively the already approved DK Architect art pack.
  // Missing or slow-loading images use the existing primitive Canvas fallback.
  const spriteCache=new Map();
  let spriteRefreshScheduled=false;
  function sprite(path) {
    if(typeof Image==='undefined')return null;
    if(spriteCache.has(path))return spriteCache.get(path);
    const img=new Image();
    spriteCache.set(path,img);
    img.onload=()=>{
      if(!spriteRefreshScheduled){
        spriteRefreshScheduled=true;
        setTimeout(()=>{spriteRefreshScheduled=false;palette();draw();},0);
      }
    };
    img.onerror=()=>{spriteCache.set(path,null);};
    img.src='./assets/art/'+path;
    return img;
  }
  function readyImage(path) {
    const img=sprite(path);
    return img&&img.complete&&img.naturalWidth>0?img:null;
  }
  const direction=['north','east','south','west'];
  const categoryPath={
    altar:'temple/ritual',crystal:'temple/ritual',braziers:'temple/ritual',
    runestone:'temple/ritual',pillar:'temple/structure',statue:'temple/structure',
    door:'temple/doors',pew:'temple/furniture',coffin:'temple/furniture',
    candle:'temple/furniture',chest:'temple/furniture'
  };
  function objectImage(o) {
    const group=categoryPath[o.type];
    if(!group)return null;
    const suffix=direction[o.r||0]||'north';
    const name=o.type==='crystal'?'crystal_'+(o.spent?'spent':'active')
      :o.type==='door'?'door_'+(o.open?'open':'closed'):o.type;
    return readyImage(group+'/'+name+'_'+suffix+'.png');
  }
  function wallImage(x,y) {
    const on=(a,b)=>inside(a,b)&&!!scene.walls[index(a,b)];
    const n=on(x,y-1),e=on(x+1,y),s=on(x,y+1),w=on(x-1,y);
    const count=Number(n)+Number(e)+Number(s)+Number(w);
    let name='wall_cross',face='north';
    if(count<=1) {
      name='wall_end';face=n?'east':e?'north':s?'west':w?'south':'north';
    }else if(count===2){
      if(n&&s){name='wall_straight';face='east';}
      else if(e&&w){name='wall_straight';face='north';}
      else{
        name='wall_corner';
        face=n&&e?'south':e&&s?'north':s&&w?'east':'west';
      }
    }else if(count===3){
      name='wall_t';face=!n?'north':!e?'east':!s?'south':'west';
    }
    return readyImage('temple/walls/'+name+'_'+face+'.png');
  }
  function art(g,o) {
    const picture=objectImage(o),size=dims(o);
    if(picture && !(o.type==='statue' && size[0]!==1)){
      g.drawImage(picture,o.x*TILE,o.y*TILE,size[0]*TILE,size[1]*TILE);
      return;
    }
    const a=baseSize(o.type), d=dims(o);
    g.save();
    g.translate((o.x+d[0]/2)*TILE,(o.y+d[1]/2)*TILE);
    g.rotate((o.r||0)*Math.PI/2);
    g.translate(-a.w*TILE/2,-a.h*TILE/2);
    const w=a.w*TILE,h=a.h*TILE;
    if (o.type !== 'candle' && o.type !== 'crystal' && o.type !== 'door')
      pixel(g,'#14131a',3,h-4,w-3,5);
    switch(o.type) {
      case 'altar':
        pixel(g,'#18161b',0,16,w,39);pixel(g,'#61515b',3,5,w-6,h-15);
        pixel(g,'#3c333b',7,10,w-14,h-24);pixel(g,'#8f747e',4,5,w-8,4);
        pixel(g,'#81414d',19,16,w-38,h-37);pixel(g,'#b56677',25,22,w-50,3);
        pixel(g,'#1b161c',w/2-17,h/2-8,34,16);pixel(g,'#d1a1a4',w/2-3,h/2-3,6,6);
        for(let i=0;i<3;i++)pixel(g,'#c16870',26+i*33,49,6,3);
        break;
      case 'crystal':
        if (!o.spent) {
          g.shadowColor='#a5a1ff';g.shadowBlur=17;pixel(g,'#6f538b',8,9,16,16);g.shadowBlur=0;
          pixel(g,'#9c82d0',13,3,6,5);pixel(g,'#b7a6fb',10,9,13,6);
          pixel(g,'#eee3ff',15,6,4,4);pixel(g,'#765b9f',10,15,13,8);
          pixel(g,'#5b477b',13,23,7,5);pixel(g,'#d1bcff',6,16,3,3);
        } else {
          pixel(g,'#44374b',9,14,14,9);pixel(g,'#87778b',14,13,4,4);
        }
        break;
      case 'braziers':
        pixel(g,'#62525a',5,23,22,7);pixel(g,'#28212b',9,17,14,10);
        pixel(g,'#a46b6b',6,14,20,6);pixel(g,'#4a242f',9,10,14,7);
        pixel(g,'#aa4058',11,6,5,9);pixel(g,'#ed9b70',15,3,5,10);
        pixel(g,'#e7b480',20,10,4,5);break;
      case 'runestone':
        pixel(g,'#2a2a32',7,4,18,24);pixel(g,'#6a626a',8,3,16,20);
        pixel(g,'#433b44',11,7,10,12);pixel(g,'#b87391',15,10,3,8);
        pixel(g,'#b87391',11,13,10,2);break;
      case 'pillar':
        pixel(g,'#1d1c23',3,5,26,26);pixel(g,'#6e6874',6,3,20,24);
        pixel(g,'#9e8b91',4,2,24,6);pixel(g,'#3d3945',9,10,14,13);
        pixel(g,'#756a77',5,25,22,5);pixel(g,'#beb1b3',6,3,18,2);break;
      case 'door':
        pixel(g,'#19151e',2,0,28,32);pixel(g,'#6c5964',2,0,28,6);
        pixel(g,'#6c5964',2,6,5,26);pixel(g,'#6c5964',25,6,5,26);
        pixel(g,o.open?'#272233':'#523645',7,6,18,26);
        if (!o.open) {
          for(let i=0;i<4;i++)pixel(g,'#b38e9c',8,8+i*6,17,2);
          pixel(g,'#d6ad7b',19,17,3,3);
        } else {
          pixel(g,'#967b8b',8,7,2,24);pixel(g,'#0c101a',11,10,13,22);
        } break;
      case 'statue':
        pixel(g,'#35333d',6,51,20,11);pixel(g,'#77707c',8,47,17,10);
        pixel(g,'#7b7080',13,5,8,13);pixel(g,'#c0aeb8',13,6,6,9);
        pixel(g,'#554a5c',9,19,16,30);pixel(g,'#a18b9b',12,20,9,24);
        pixel(g,'#4d424f',7,26,7,22);pixel(g,'#776674',22,25,5,22);
        break;
      case 'pew':
        pixel(g,'#32252d',2,15,59,14);pixel(g,'#775560',5,8,54,15);
        pixel(g,'#a27773',5,8,54,5);pixel(g,'#4f3640',4,24,9,7);
        pixel(g,'#4f3640',52,24,8,7);break;
      case 'coffin':
        pixel(g,'#22202a',1,9,62,22);pixel(g,'#706b77',3,6,58,21);
        pixel(g,'#38343c',9,9,46,15);pixel(g,'#9a7b85',28,10,5,13);
        pixel(g,'#9a7b85',21,14,19,4);break;
      case 'candle':
        pixel(g,'#5b4552',3,27,26,4);pixel(g,'#d9b7a6',6,15,5,12);
        pixel(g,'#c8a89d',14,13,5,14);pixel(g,'#ead1b3',22,19,4,9);
        pixel(g,'#f6a971',7,10,3,6);pixel(g,'#ffe2a1',15,7,3,6);
        pixel(g,'#d99460',23,14,2,5);break;
      case 'chest':
        pixel(g,'#241a23',3,10,26,20);pixel(g,'#68454a',5,8,22,20);
        pixel(g,'#9f7a6b',7,8,18,5);pixel(g,'#c3a36c',14,13,4,13);
        pixel(g,'#b08b6f',7,21,18,3);break;
    }
    g.restore();
  }
  function floorTile(x,y,type) {
    const picture=readyImage('temple/floors/floor_'+type+'_north.png');
    if(picture){ctx.drawImage(picture,x*TILE,y*TILE,TILE,TILE);return;}
    const col=FLOOR[type]?.color || FLOOR.stone.color, ox=x*TILE,oy=y*TILE;
    pixel(ctx,col,ox,oy,TILE,TILE);
    const seed=(x*17+y*41+x*y*13)%11;
    pixel(ctx,'#4d4650',ox+1,oy+2,28,1);
    pixel(ctx,'#211e27',ox+30,oy+3,2,28);
    if(seed%3===0) {pixel(ctx,'#524a55',ox+7,oy+15,10,1);pixel(ctx,'#211d26',ox+17,oy+15,1,7);}
    if(type==='cracked') {pixel(ctx,'#231d29',ox+12,oy+7,2,8);pixel(ctx,'#231d29',ox+14,oy+15,7,1);}
    if(type==='sigil') {
      pixel(ctx,'#995160',ox+12,oy+9,8,2);pixel(ctx,'#995160',ox+14,oy+7,3,17);
      pixel(ctx,'#854456',ox+9,oy+19,14,2);
    }
  }
  function wallTile(x,y) {
    const picture=wallImage(x,y);
    if(picture){ctx.drawImage(picture,x*TILE,y*TILE,TILE,TILE);return;}
    const ox=x*TILE,oy=y*TILE;pixel(ctx,'#100f15',ox,oy,32,32);
    pixel(ctx,'#625963',ox+1,oy+1,30,9);pixel(ctx,'#a08a94',ox+2,oy+2,28,2);
    pixel(ctx,'#38343e',ox+1,oy+11,30,20);
    pixel(ctx,'#594650',ox+3,oy+13,23,2);
    pixel(ctx,'#201c24',ox+14,oy+14,2,17);
  }
  function playerSprite() {
    const p=scene.player,position=ritual?ritual.visual:visual,
      x=position.x*TILE,y=position.y*TILE,
      ghost=ritual?ritual.phase==='spirit':p.form==='ghost';
    const spriteGroup=ghost?'ghost':'human';
    const image=readyImage('characters/'+spriteGroup+'/'+spriteGroup+'_'+p.facing+'.png');
    if(image){
      ctx.drawImage(image,Math.round(x),Math.round(y),TILE,TILE);
      return;
    }
    ctx.save();ctx.translate(x,y);
    if(ghost){
      ctx.globalAlpha=.86;ctx.shadowColor='#a3b8ec';ctx.shadowBlur=9;
      pixel(ctx,'#7388b6',10,6,12,17);pixel(ctx,'#bcc8e1',12,3,8,10);
      pixel(ctx,'#8999bc',8,17,16,10);pixel(ctx,'#b1bddd',6,16,4,8);
      pixel(ctx,'#b1bddd',22,16,4,8);pixel(ctx,'#607799',10,26,5,4);
      pixel(ctx,'#b4c5e0',19,24,5,5);ctx.shadowBlur=0;
      pixel(ctx,'#202337',13,9,2,3);pixel(ctx,'#202337',18,9,2,3);
      pixel(ctx,'#e2edff',12,7,2,2);ctx.globalAlpha=1;
    } else {
      pixel(ctx,'#16131a',10,23,5,7);pixel(ctx,'#16131a',18,23,5,7);
      pixel(ctx,'#603744',8,13,16,14);pixel(ctx,'#9c6570',7,17,5,10);
      pixel(ctx,'#9c6570',21,17,5,10);pixel(ctx,'#d8b4a3',12,5,10,11);
      pixel(ctx,'#30232c',11,3,12,5);pixel(ctx,'#392733',11,9,2,4);
      pixel(ctx,'#231e28',15,11,2,2);pixel(ctx,'#231e28',21,11,2,2);
      pixel(ctx,'#d3b6ab',13,14,8,3);
    }
    const facing={north:[13,2],south:[13,29],west:[2,14],east:[28,14]};
    const m=facing[p.facing]||facing.north;
    pixel(ctx,ghost?'#e9edff':'#d8a483',m[0],m[1],4,2);
    ctx.restore();
  }
  function draw() {
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,512,512);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)floorTile(x,y,scene.floor[index(x,y)]);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(scene.walls[index(x,y)])wallTile(x,y);
    scene.objects.forEach(o=>art(ctx,o));
    drawCorpse();drawWoman();playerSprite();
    if(mode==='edit'){
      ctx.strokeStyle='rgba(190,150,174,.24)';ctx.lineWidth=1;ctx.beginPath();
      for(let i=0;i<=N;i++){
        ctx.moveTo(i*TILE+.5,0);ctx.lineTo(i*TILE+.5,N*TILE);
        ctx.moveTo(0,i*TILE+.5);ctx.lineTo(N*TILE,i*TILE+.5);
      }ctx.stroke();
      if(selectedId){const o=objectAtId(selectedId);if(o){
        const [w,h]=dims(o);ctx.strokeStyle='#f2c58b';ctx.lineWidth=3;
        ctx.strokeRect(o.x*TILE+2,o.y*TILE+2,w*TILE-4,h*TILE-4);
      }}
      if(corner){ctx.strokeStyle='#e5bfd8';ctx.lineWidth=3;ctx.strokeRect(corner.x*TILE+2,corner.y*TILE+2,TILE-4,TILE-4);}
    }
    if(hover&&mode==='edit'){
      if(tool==='place'&&CATALOG[current]){
        const preview={id:'__architect_preview__',type:current,x:hover.x,y:hover.y,
          r:previewRotation,open:true,spent:false};
        const [pw,ph]=dims(preview);
        const allowed=canPlace(preview);
        ctx.save();ctx.globalAlpha=allowed?.58:.32;
        art(ctx,preview);ctx.restore();
        ctx.lineWidth=2;ctx.strokeStyle=allowed?'#7bcb88':'#f18585';
        ctx.strokeRect(preview.x*TILE+1,preview.y*TILE+1,pw*TILE-2,ph*TILE-2);
      }else{
        ctx.strokeStyle='#c0b9dc';ctx.lineWidth=1;
        ctx.strokeRect(hover.x*TILE+1,hover.y*TILE+1,TILE-2,TILE-2);
      }
    }
    $('position').textContent='('+scene.player.x+', '+scene.player.y+')';
    $('lifeState').textContent=scene.player.form==='ghost'?'GHOST · secret path':'RESURRECTED · mortal path';
    $('lifeState').style.color=scene.player.form==='ghost'?'#b9c6f4':'#f5b7bb';
    $('objectCount').textContent=String(scene.objects.length);
    const o=objectAtId(selectedId);
    $('itemInfo').textContent=o?CATALOG[o.type].label+' ('+o.x+', '+o.y+')':'None';
    $('saveState').textContent=dirty?'Unsaved edits':loaded?'Saved layout':'Starter scene';
    $('modeLabel').textContent=mode==='walk'?'WALK MODE':'ARCHITECT MODE';
    $('coordTop').textContent=hover?'X '+hover.x+' · Y '+hover.y:'16 × 16 · 32 PX';
    $('selectedTool').textContent=tool.toUpperCase();
    $('walkMode').classList.toggle('active',mode==='walk');$('editMode').classList.toggle('active',mode==='edit');
    $('walkMode').setAttribute('aria-pressed',String(mode==='walk'));$('editMode').setAttribute('aria-pressed',String(mode==='edit'));
  }
  function palette() {
    const list=$('palette');list.replaceChildren();$('paletteTitle').textContent=GROUPS[category];
    const entries=category==='floors'?Object.entries(FLOOR):Object.entries(CATALOG).filter(([,a])=>a.category===category);
    for(const [key,entry] of entries){
      const b=document.createElement('button');b.type='button';b.className=current===key?'active':'';
      const mini=document.createElement('canvas');mini.width=32;mini.height=32;mini.setAttribute('aria-hidden','true');
      const c=mini.getContext('2d');c.imageSmoothingEnabled=false;
      if(category==='floors'){
        c.fillStyle=entry.color;c.fillRect(0,0,32,32);
        c.strokeStyle='#8e6676';c.strokeRect(2,2,28,28);
        if(key==='sigil'){c.fillStyle='#bf748e';c.fillRect(15,8,3,16);c.fillRect(9,15,16,3);}
      }else{
        const base=CATALOG[key];c.scale(1/base.w,1/base.h);art(c,{type:key,x:0,y:0,r:0,open:false});
      }
      const span=document.createElement('span');span.textContent=entry.label;
      b.append(mini,span);b.addEventListener('click',()=>{
        current=key;previewRotation=0;if(category==='floors'&&tool==='place')$('tool').value=tool='floor';
        if(category!=='floors'&&tool==='floor')$('tool').value=tool='place';
        palette();draw();message('Selected '+entry.label+'. Click a grid coordinate in Architect Mode.');
      });list.append(b);
    }
  }
  function setMode(next) {
    rightMouseHeld=false;
    resetVisual();
    mode=next;selectedId=null;corner=null;
    draw();message(next==='edit'?'Architect Mode active. Every tile and object has an exact grid address.':opening?'Opening scene is still playing.':ritual?'The resurrection ritual is still playing.':'Walk Mode active. Single-click the soul crystal to inspect; double-left-click to resurrect, or remain a ghost.');
    canvas.focus({preventScroll:true});
  }
  function facing(dx,dy){
    return Math.abs(dx)>=Math.abs(dy)?(dx>=0?'east':'west'):(dy>=0?'south':'north');
  }
  function step(dx,dy) {
    if (opening||ritual) {message('Wait for the opening or resurrection sequence to finish.');return false;}
    const p=scene.player,nx=p.x+dx,ny=p.y+dy;
    p.facing=facing(dx,dy);
    if(!canStand(nx,ny)){draw();message('Blocked at ('+nx+', '+ny+'). The '+(p.form==='ghost'?'stone boundary':'wall or solid object')+' bars your way.');return false;}
    p.x=nx;p.y=ny;dirty=true;
    visual.queue.push({x:nx,y:ny});
    draw();persistCharacter();
    if(nx===8&&ny===0)message('NORTHERN ARCH: connected courtyard is planned, not implemented in this test. You remain in '+AREA+'.');
    else message((p.form==='ghost'?'Ghost':'Living')+' at '+AREA+' ('+nx+', '+ny+').');
    return true;
  }
  // Ultima Online controls: left mouse INTERACTS. Holding right mouse MOVES.
  // The render position animates continuously between logical 32px tiles.
  function interactAt(x,y, doubleClick=false) {
    if (opening||ritual) {message('Wait for the current scene to finish.');return;}
    const obj=objectAt(x,y),p=scene.player;
    if (!obj) return message('There is nothing here to interact with.');
    const [w,h]=dims(obj);
    const distanceX=Math.max(obj.x-p.x,0,p.x-(obj.x+w-1));
    const distanceY=Math.max(obj.y-p.y,0,p.y-(obj.y+h-1));
    if(distanceX+distanceY>1)return message('Move closer to the '+CATALOG[obj.type].label+' to interact.');
    if(obj.type==='door') {
      obj.open=!obj.open;dirty=true;draw();persistCharacter();
      message('Iron arch '+(obj.open?'opened':'closed')+'.');return;
    }
    if(obj.type==='crystal'&&!obj.spent&&p.form==='ghost') {
      // A normal click inspects; only a deliberate double click resurrects.
      if (!doubleClick) {message('A glowing gold crystal.');return;}
      beginResurrection();draw();return;
    }
    message(CATALOG[obj.type].label+(obj.type==='crystal'&&obj.spent?' (spent)':'')+'.');
  }
  function pointerPosition(e) {
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height)return null;
    return {x:(e.clientX-r.left)/r.width*N*TILE,y:(e.clientY-r.top)/r.height*N*TILE};
  }
  function moveTowardPointer(dt) {
    if(!rightPointer||dt<=0)return;
    // Unlike keyboard navigation, the held mouse directly moves the rendered
    // character in sub-tile increments. Four static facings, no walk cycles.
    visual.queue.length=0;
    const dx=rightPointer.x-(visual.x+.5)*TILE;
    const dy=rightPointer.y-(visual.y+.5)*TILE;
    const pixels=Math.hypot(dx,dy);
    if(pixels<=TILE*.55)return;
    const tilesToTravel=Math.min(pixels/TILE-.35,(pixels>4*TILE?5.6:3.1)*dt);
    if(tilesToTravel<=0)return;
    const ax=dx/pixels*tilesToTravel,ay=dy/pixels*tilesToTravel;
    const legal=(x,y)=>{
      const tx=Math.round(x),ty=Math.round(y);
      if(!canStand(tx,ty))return false;
      const p=scene.player;
      // Prevent diagonally cutting through the corners of two solid tiles.
      if(tx!==p.x&&ty!==p.y&&(!canStand(tx,p.y)||!canStand(p.x,ty)))return false;
      return true;
    };
    let nx=visual.x+ax,ny=visual.y+ay;
    if(!legal(nx,ny)){
      if(legal(nx,visual.y))ny=visual.y;
      else if(legal(visual.x,ny))nx=visual.x;
      else return;
    }
    const vx=nx-visual.x,vy=ny-visual.y;
    if(!vx&&!vy)return;
    visual.x=nx;visual.y=ny;
    const p=scene.player,tx=Math.round(nx),ty=Math.round(ny);
    p.facing=facing(vx,vy);
    if(p.x!==tx||p.y!==ty){
      p.x=tx;p.y=ty;dirty=true;persistCharacter();
      if(tx===8&&ty===0)
        message('NORTHERN ARCH: connected courtyard is planned, not implemented in this test.');
    }
    draw();
  }
  function advanceFrame(now) {
    const dt=lastFrameTime?Math.max(0,Math.min((now-lastFrameTime)/1000,.06)):0;
    lastFrameTime=now;
    if(opening){updateOpening(dt);draw();requestAnimationFrame(advanceFrame);return;}
    if(ritual){updateResurrection(dt);draw();requestAnimationFrame(advanceFrame);return;}
    if(rightMouseHeld&&mode==='walk'&&rightPointer){
      moveTowardPointer(dt);
    }else if(visual.queue.length){
      const target=visual.queue[0];
      const dx=target.x-visual.x,dy=target.y-visual.y;
      const distance=Math.hypot(dx,dy);
      const change=Math.min(distance,3.1*dt);
      if(distance<=.001||change>=distance){
        visual.x=target.x;visual.y=target.y;visual.queue.shift();
      }else if(distance>0){
        visual.x+=dx/distance*change;visual.y+=dy/distance*change;
      }
      draw();
    }
    requestAnimationFrame(advanceFrame);
  }
  function idFor(type){serial+=1;return type+'_'+Date.now().toString(36)+'_'+serial.toString(36);}
  function applyEdit(x,y){
    const here=objectAt(x,y),i=index(x,y);
    if(tool==='pick'){
      if(here){current=here.type;category=CATALOG[here.type].category;tool='place';$('category').value=category;$('tool').value=tool;palette();draw();message('Eyedropper: '+CATALOG[here.type].label);}
      else{current=scene.floor[i];category='floors';tool='floor';$('category').value=category;$('tool').value=tool;palette();draw();message('Eyedropper: '+FLOOR[current].label);}
      return;
    }
    if(tool==='select'){
      if(selectedId&&(!here||here.id!==selectedId)){
        const obj=objectAtId(selectedId);
        if(!obj){selectedId=null;draw();return;}
        const result=transact(()=>{
          const candidate={...obj,x,y};if(canPlace(candidate,obj.id)){obj.x=x;obj.y=y;}
        },'Moved '+CATALOG[obj.type].label+' to ('+x+', '+y+').');
        if(result)selectedId=null;draw();return;
      }
      selectedId=here?.id||null;draw();
      message(here?'Selected '+CATALOG[here.type].label+' #'+here.id+' at ('+here.x+', '+here.y+'). Click destination to move.':'No object occupies ('+x+', '+y+').');
      return;
    }
    if(tool==='erase'){
      transact(()=>{
        if(here)scene.objects=scene.objects.filter(o=>o.id!==here.id);
        else if(scene.walls[i])scene.walls[i]=0;
      },'Removed '+(here?CATALOG[here.type].label:'wall')+' at ('+x+', '+y+').');selectedId=null;return;
    }
    if(tool==='wall'){
      transact(()=>{
        if(here)return;
        scene.walls[i]=scene.walls[i]?0:1;
      },'Toggled stone wall at ('+x+', '+y+').');return;
    }
    if(tool==='door'){
      if(!here||here.type!=='door')return message('Choose a doorway tile to toggle its open/closed state.');
      transact(()=>{here.open=!here.open;},'Door '+(here.open?'closed':'opened')+' at ('+x+', '+y+').');return;
    }
    if(tool==='spawn'){
      if(!canStand(x,y))return message('Spawn must be placed on a walkable tile.');
      transact(()=>{scene.spawn={x,y};scene.player.x=x;scene.player.y=y;},'Spawn and player moved to ('+x+', '+y+').');return;
    }
    if(tool==='floor'||tool==='fill'||tool==='rectangle'){
      const floor=Object.hasOwn(FLOOR,current)?current:'stone';
      if(tool==='rectangle'&&!corner){corner={x,y};draw();message('First corner ('+x+', '+y+'). Choose the opposite corner.');return;}
      transact(()=>{
        if(tool==='floor')scene.floor[i]=floor;
        else if(tool==='rectangle'){
          for(let yy=Math.min(corner.y,y);yy<=Math.max(corner.y,y);yy++)
            for(let xx=Math.min(corner.x,x);xx<=Math.max(corner.x,x);xx++)scene.floor[index(xx,yy)]=floor;
        }else{
          const old=scene.floor[i];if(old===floor)return;
          const queue=[[x,y]],seen=new Set([i]);
          for(let q=0;q<queue.length;q++){
            const [px,py]=queue[q];scene.floor[index(px,py)]=floor;
            for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
              const nx=px+dx,ny=py+dy,k=index(nx,ny);
              if(inside(nx,ny)&&!seen.has(k)&&scene.floor[k]===old){seen.add(k);queue.push([nx,ny]);}
            }
          }
        }
      },'Painted '+FLOOR[floor].label+' at ('+x+', '+y+').');
      corner=null;draw();return;
    }
    if(tool==='place'){
      if(!CATALOG[current])return message('Choose a relic, structure or prop from the palette.');
      const obj={id:idFor(current),type:current,x,y,r:previewRotation};
      if(current==='door')obj.open=true;
      if(current==='crystal')obj.spent=false;
      transact(()=>{if(canPlace(obj))scene.objects.push(obj);},'Placed '+CATALOG[current].label+' at ('+x+', '+y+').');return;
    }
  }
  function rotateSelected() {
    const obj=objectAtId(selectedId);if(!obj)return message('Select an object before rotating.');
    transact(()=>{const next={...obj,r:(obj.r+1)%4};if(canPlace(next,obj.id))obj.r=next.r;},'Rotated '+CATALOG[obj.type].label+'.');
  }
  function duplicateSelected() {
    const obj=objectAtId(selectedId);if(!obj)return message('Select an object to duplicate.');
    const next={...clone(obj),id:idFor(obj.type),x:obj.x+1};
    transact(()=>{if(canPlace(next))scene.objects.push(next);},'Duplicated '+CATALOG[obj.type].label+'.');
  }
  function deleteSelected() {
    if(!selectedId)return message('Select an object before deleting.');
    const obj=objectAtId(selectedId);if(!obj)return;
    transact(()=>{scene.objects=scene.objects.filter(o=>o.id!==selectedId);},'Deleted '+CATALOG[obj.type].label+'.');
    selectedId=null;draw();
  }
  function checkAccess() {
    const seen=new Set([index(scene.player.x,scene.player.y)]),queue=[[scene.player.x,scene.player.y]];
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,k=index(nx,ny);
        if(!seen.has(k)&&canStand(nx,ny)){seen.add(k);queue.push([nx,ny]);}
      }
    }
    message('ACCESS CHECK: '+seen.size+' of '+COUNT+' tiles reachable as '+scene.player.form+'. Northern arch '+(seen.has(index(8,0))?'reachable.':'unreachable.'));
  }
  function validate(data) {
    if(!data||data.schema!==1||data.area_id!==AREA||data.width!==N||data.height!==N||data.tile_size!==TILE)
      throw Error('Not a Demon Killer temple test-center file.');
    if(!Array.isArray(data.floor)||!Array.isArray(data.walls)||data.floor.length!==COUNT||data.walls.length!==COUNT)
      throw Error('Expected exactly 256 floor and 256 wall cells.');
    if(!data.floor.every(v=>Object.hasOwn(FLOOR,v))||!data.walls.every(v=>v===0||v===1))
      throw Error('Unknown floor or wall tile.');
    if(!Array.isArray(data.objects)||data.objects.length>160)throw Error('Invalid object count.');
    const seen=new Set();
    for(const o of data.objects){
      if(!o||!Object.hasOwn(CATALOG,o.type)||typeof o.id!=='string'||!/^[a-z0-9_-]{1,60}$/i.test(o.id)||seen.has(o.id))
        throw Error('Invalid, repeated or unsupported object ID.');
      seen.add(o.id);
      if(!inside(o.x,o.y)||!Number.isInteger(o.r)||o.r<0||o.r>3)throw Error('Invalid object coordinates or rotation.');
      const [w,h]=dims(o);if(!inside(o.x+w-1,o.y+h-1))throw Error('Object crosses area boundary.');
      if(o.type==='door'&&typeof o.open!=='boolean')throw Error('Door must have an open/closed state.');
      if(o.type==='crystal'&&typeof o.spent!=='boolean')throw Error('Crystal must have a spent state.');
    }
    if(!data.spawn||!inside(data.spawn.x,data.spawn.y)||!data.player||!inside(data.player.x,data.player.y))
      throw Error('Invalid player or spawn coordinates.');
    if(!['ghost','living'].includes(data.player.form)||!['north','south','east','west'].includes(data.player.facing))
      throw Error('Unknown player state.');
    if ('introSeen' in data && typeof data.introSeen!=='boolean')throw Error('Invalid intro completion flag.');
    return clone(data);
  }
  function save() {
    try{localStorage.setItem(STORE,JSON.stringify(scene));persistCharacter();dirty=false;loaded=true;draw();message('Temple layout saved under its own Demon Killer test-center key'+(activeSlot?' and named character record':'')+'.');}
    catch(err){message('Browser storage unavailable: '+err.message+'. Use Export Room JSON instead.');}
  }
  function load() {
    try{const raw=localStorage.getItem(STORE);if(!raw)return message('No saved test-center room found.');
      const next=validate(JSON.parse(raw));scene=next;opening=null;ritual=null;rightMouseHeld=false;undoStack=[];redoStack=[];selectedId=null;corner=null;dirty=false;loaded=true;resetVisual();draw();message('Saved temple room loaded.');}
    catch(err){message('Could not load room: '+err.message);}
  }
  function exportRoom() {
    const blob=new Blob([JSON.stringify(scene,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='demon-killer-temple-test-center.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('Exported room, object coordinates and ghost/resurrection state as JSON.');
  }
  function reset() {
    undoStack.push(clone(scene));if(undoStack.length>70)undoStack.shift();
    redoStack=[];scene=fresh();mode='walk';selectedId=null;corner=null;dirty=true;opening=null;ritual=null;resetVisual();
    if(typeof window!=='undefined'&&typeof requestAnimationFrame==='function')startOpening();
    draw();message('Sacrificial temple reset. You awaken as a ghost once more. Saved browser layout remains intact until you press Save.');
  }
  function mouseTile(e) {
    const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*N),y=Math.floor((e.clientY-r.top)/r.height*N);
    return inside(x,y)?{x,y}:null;
  }
  canvas.addEventListener('click',e=>{
    if(e.button && e.button!==0)return;
    const p=mouseTile(e);if(!p)return;
    if(mode==='edit')applyEdit(p.x,p.y);else interactAt(p.x,p.y);
    canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('dblclick',e=>{
    if(mode!=='walk'||e.button!==0)return;
    const p=mouseTile(e);if(!p)return;
    interactAt(p.x,p.y,true);
    canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('contextmenu',e=>{if(mode==='walk')e.preventDefault();});
  canvas.addEventListener('mousedown',e=>{
    if(mode==='walk'&&e.button===2){
      e.preventDefault();rightPointer=pointerPosition(e);
      // Keyboard tween queues must not delay held-mouse movement.
      if(visual.queue.length){
        visual.queue.length=0;
        const nx=Math.round(visual.x),ny=Math.round(visual.y);
        if(canStand(nx,ny)){scene.player.x=nx;scene.player.y=ny;}
      }
      rightMouseHeld=true;
      canvas.focus({preventScroll:true});
    }
  });
  function stopRightMovement() {
    if(!rightMouseHeld)return;
    rightMouseHeld=false;
    if(mode!=='walk'||opening||ritual)return;
    // Render coordinates remain exactly where mouse was released. No queued
    // completion step; only the persisted grid coordinate is snapped.
    visual.queue.length=0;
    const nx=Math.round(visual.x),ny=Math.round(visual.y);
    if(canStand(nx,ny)){
      scene.player.x=nx;scene.player.y=ny;dirty=true;
      persistCharacter();
    }
    draw();
  }
  canvas.addEventListener('mouseup',e=>{if(e.button===2)stopRightMovement();});
  if(typeof window!=='undefined'){
    window.addEventListener('mouseup',e=>{if(e.button===2)stopRightMovement();});
    window.addEventListener('blur',stopRightMovement);
  }
  canvas.addEventListener('wheel',e=>{
    if(mode!=='edit'||tool!=='place'||!CATALOG[current])return;
    e.preventDefault();
    previewRotation=(previewRotation+(e.deltaY>0?1:3))%4;
    draw();message('Unplaced '+CATALOG[current].label+' facing '+direction[previewRotation]+'.');
  },{passive:false});
  canvas.addEventListener('mousemove',e=>{
    if(mode==='walk'){rightPointer=pointerPosition(e);return;}
    const p=mouseTile(e);if(!p)return;
    if(!hover||p.x!==hover.x||p.y!==hover.y){hover=p;draw();}
  });
  canvas.addEventListener('mouseleave',()=>{hover=null;stopRightMovement();draw();});
  document.addEventListener('keydown',e=>{
    const name=e.target?.tagName;
    if(name==='INPUT'||name==='SELECT'||name==='TEXTAREA')return;
    if(!$('cultJournal').hidden)return; // Cult overlay holds keyboard focus.
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
    if(mode==='edit'){
      if(e.key.toLowerCase()==='r'){e.preventDefault();rotateSelected();}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}
      return;
    }
    const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
    const v=directions[e.key.length===1?e.key.toLowerCase():e.key];
    if(v){e.preventDefault();step(v[0],v[1]);}
  });
  $('walkMode').addEventListener('click',()=>setMode('walk'));
  $('editMode').addEventListener('click',()=>setMode('edit'));
  $('tool').addEventListener('change',e=>{tool=e.target.value;corner=null;selectedId=null;draw();message('Architect tool: '+e.target.selectedOptions[0].textContent+'.');});
  $('category').addEventListener('change',e=>{
    category=e.target.value;previewRotation=0;current=category==='floors'?'stone':Object.keys(CATALOG).find(k=>CATALOG[k].category===category);
    if(category==='floors'){tool='floor';$('tool').value=tool;}
    else if(['floor','fill','rectangle'].includes(tool)){tool='place';$('tool').value=tool;}
    palette();draw();
  });
  $('rotate').addEventListener('click',rotateSelected);
  $('duplicate').addEventListener('click',duplicateSelected);
  $('remove').addEventListener('click',deleteSelected);
  $('inspect').addEventListener('click',checkAccess);
  $('undo').addEventListener('click',undo);
  $('redo').addEventListener('click',redo);
  $('save').addEventListener('click',save);
  $('load').addEventListener('click',load);
  $('new').addEventListener('click',reset);
  $('export').addEventListener('click',exportRoom);
  $('import').addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      if(f.size>250000)throw Error('File exceeds 250 KB test-center limit.');
      const next=validate(JSON.parse(await f.text()));scene=next;selectedId=null;corner=null;undoStack=[];redoStack=[];dirty=true;loaded=false;draw();
      message('Imported '+scene.area_id+' with '+scene.objects.length+' coordinate-addressed objects. Save explicitly to keep it.');
    }catch(err){message('Import rejected: '+err.message);}
    finally{e.target.value='';}
  });
  // The player journal reveals only learned evidence; actual affiliations
  // remain in this per-world simulation, never in the journal's HTML.
  function saveCultWorld(){
    const record=characterRecord();
    if(!record||!cultWorld)return;
    try{
      record.slot.cultWorld=clone(cultWorld);
      if(populationWorld)record.slot.populationWorld=clone(populationWorld);
      localStorage.setItem(CHARACTERS_STORE,JSON.stringify(record.data));
    }catch(error){message('Cult record could not be saved: '+error.message);}
  }
  function renderCultJournal(){
    if(cultNetworkView)cultNetworkView.refresh();
  }
  function initializePopulation(record){
    if(!Population||!cultWorld)return;
    if(record&&record.slot.populationWorld&&Population.validate(record.slot.populationWorld)){
      try{
        if(record.slot.populationWorld.seed===cultWorld.seed)
          populationWorld=Population.restore(record.slot.populationWorld);
      }catch(error){populationWorld=null;}
    }
    if(!populationWorld)populationWorld=Population.create(cultWorld.seed);
    // Seed only missing citizens. Never replace discovered or existing cult state.
    for(const profile of Population.profiles(populationWorld))
      Cult.addCitizen(cultWorld,profile);
    saveCultWorld();
  }
  function mountSocietyHooks(){
    if(!Population||!populationWorld||!cultWorld)return;
    // Population remains simulated under the cult board; no public registry
    // appears in the cult menu, and no citizen is encountered automatically.
    if(typeof window!=='undefined')window.DemonKillerPopulationHooks=Object.freeze({
      publicRegister:()=>Population.publicRegister(populationWorld),
      publicRecord:id=>Population.publicRecord(populationWorld,id),
      schedule:id=>Population.whereabouts(populationWorld,id),
      currentTime:()=>({day:populationWorld.day,hour:populationWorld.hour}),
      advanceHours:hours=>{
        const time=Population.advanceHours(populationWorld,hours);
        saveCultWorld();return time;
      },
      encounter:id=>{
        Population.publicRecord(populationWorld,id);
        const dossier=Cult.meet(cultWorld,id);
        saveCultWorld();renderCultJournal();
        return dossier;
      }
    });
  }
  function mountCultJournal(){
    if(!Cult)return;
    const record=characterRecord();
    if(record&&record.slot.cultWorld&&Cult.valid(record.slot.cultWorld)){
      try{cultWorld=Cult.restore(record.slot.cultWorld);}catch(error){cultWorld=null;}
    }
    if(!cultWorld){
      const seed=record?(record.slot.worldSeed||'legacy-'+record.slot.id+'-'+record.slot.name+'-'+record.slot.updated)
        :'guest-'+Date.now();
      // Known story participant, but no secret identity is revealed until discovered.
      cultWorld=Cult.createWorld(seed,[{id:'temple_ritualist',name:'Unknown robed figure',
        occupation:'Unknown',fixed:true}]);
      saveCultWorld();
    }
    initializePopulation(record);
    const panel=$('cultJournal'),toggle=$('cultJournalToggle'),close=$('cultJournalClose');
    if(!panel||!toggle||!close)return;
    const show=open=>{
      panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
      if(open){stopRightMovement();renderCultJournal();}
    };
    toggle.addEventListener('click',()=>show(panel.hidden));
    close.addEventListener('click',()=>show(false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)show(false);});
    // Future NPC and scene scripts may report discoveries and political events.
    if(typeof window!=='undefined')window.DemonKillerCultHooks=Object.freeze({
      registerCitizen:profile=>{const c=Cult.addCitizen(cultWorld,profile);saveCultWorld();return c.id;},
      meet:id=>{const d=Cult.meet(cultWorld,id);saveCultWorld();renderCultJournal();return d;},
      evidence:(id,clue)=>{const d=Cult.recordEvidence(cultWorld,id,clue);saveCultWorld();renderCultJournal();return d;},
      recruit:(id,opts)=>{const r=Cult.recruit(cultWorld,id,opts);saveCultWorld();renderCultJournal();return r;},
      depart:id=>{const r=Cult.depart(cultWorld,id);saveCultWorld();renderCultJournal();return r;},
      kill:id=>{const r=Cult.kill(cultWorld,id);
        if(r&&cultWorld.trackedCultistId===id)cultWorld.trackedCultistId=null;
        saveCultWorld();renderCultJournal();return r;},
      promote:(id,branch)=>{const r=Cult.promote(cultWorld,id,branch);saveCultWorld();renderCultJournal();return r;},
      circumstances:(id,traits)=>{Cult.changeCircumstances(cultWorld,id,traits);saveCultWorld();renderCultJournal();},
      dossier:id=>Cult.dossier(cultWorld,id),
      board:()=>Cult.board(cultWorld)
    });
    mountSocietyHooks();
    if(typeof DemonKillerCultNetwork!=='undefined')
      cultNetworkView=DemonKillerCultNetwork.mount({
        document,cult:Cult,getWorld:()=>cultWorld,save:saveCultWorld
      });
    renderCultJournal();
  }
  restoreCharacter();
  mountCultJournal();
  if(typeof window!=='undefined'&&typeof requestAnimationFrame==='function'&&!scene.introSeen)startOpening();
  palette();draw();
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(advanceFrame);
})();
