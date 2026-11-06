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
  const WALL_FINISHES = {
    clean:{label:'Clean stone',color:'#796672'},
    moss:{label:'Moss-covered',color:'#636e4e'},
    cracked:{label:'Cracked masonry',color:'#67545f'},
    broken:{label:'Broken masonry',color:'#483b42'}
  };
  const WALL_TILE_PIECES=(()=>{
    const pieces={};
    const shapes=['straight','corner','t','cross','end'];
    const faces=['north','east','south','west'];
    const finishes=['clean','moss','cracked','broken'];
    for(const shape of shapes)for(const face of faces)for(const finish of finishes){
      const key='wall_'+shape+'_'+face+(finish==='clean'?'':'_'+finish);
      const label=shape==='t'?'T-junction':shape==='cross'?'Cross/post':shape[0].toUpperCase()+shape.slice(1);
      pieces[key]={label:label+' · '+face+' · '+finish,shape,face,finish};
    }
    return Object.freeze(pieces);
  })();
  const CATALOG = {
    altar: { label: 'Sacrificial Altar', category: 'relics', w: 3, h: 2, solid: true },
    crystal: { label: 'Soul Crystal', category: 'relics', w: 1, h: 1, solid: false },
    braziers: { label: 'Crimson Brazier', category: 'relics', w: 1, h: 1, solid: true },
    runestone: { label: 'Runestone', category: 'relics', w: 1, h: 1, solid: true },
    pillar: { label: 'Ruined Pillar', category: 'structure', w: 1, h: 1, solid: true },
    door: { label: 'Iron Arch Door', category: 'structure', w: 1, h: 1, solid: false },
    statue: { label: 'Veiled Statue', category: 'structure', w: 1, h: 2, solid: true },
    pew: { label: 'Temple Pew', category: 'furniture', w: 2, h: 1, solid: true },
    coffin: { label: 'Stone Sarcophagus', category: 'furniture', w: 2, h: 1, solid: true },
    candle: { label: 'Candle Cluster', category: 'furniture', w: 1, h: 1, solid: false },
    chest: { label: 'Reliquary Chest', category: 'furniture', w: 1, h: 1, solid: true },
    scenery: { label: 'Staged Sprite', category: 'library', w: 1, h: 1, solid: false }
  };
  // Only artwork already approved and available as usable game sprites is
  // placeable here. Masters awaiting extraction are intentionally excluded.
  const ARCHITECT_SPRITES=(()=>{
    const entries=Object.create(null);
    const colors=['gold','red','orange','yellow','green','cyan','blue','purple','pink'];
    for(const color of colors)for(const shade of ['bright','dim']){
      const id='crystal_'+color+'_'+shade;
      entries[id]={label:'Crystal · '+color+' '+shade,group:'crystal',path:'crystals/'+id+'.png',size:24};
    }
    entries.crystal_silver_depleted={
      label:'Crystal · silver (spent)',group:'crystal',path:'crystals/crystal_silver_depleted.png',size:24
    };
    for(const [id,name,prefix] of [
      ['ghost','Ghost (static)','characters/ghost/ghost_'],
      ['human','Human (static)','characters/human/human_'],
      ['cult-member','Cult member (static)','characters/cult-member/cult_member_'],
      ['crystal-woman','Lilith visual (static)','characters/crystal-woman/crystal_woman_']]){
      entries[id]={label:name,group:'actor',prefix,size:32};
    }
    entries['cult-leader']={label:'Cult leader visual (static)',group:'actor',
      sheet:'characters/cult-leader/cult_leader_spritesheet.png',size:32};
    entries.devil={label:'Devil visual (static)',group:'actor',
      sheet:'characters/devil/devil_spritesheet.png',size:32};
    return Object.freeze(entries);
  })();
  const GROUPS = { relics: 'Relics & Ritual', structure: 'Gothic Structure',
    furniture: 'Furniture & Props', floors: 'Stone Floors',
    walls:'Walls & Masonry',library:'Approved Sprite Library' };
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
    const wallStyles = Array(COUNT).fill('clean');
    const wallVariants = Array(COUNT).fill(null);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x === 0 || y === 0 || x === N-1 || y === N-1) {
        walls[index(x,y)] = 1;
        const wear=(x*13+y*17)%13;
        wallStyles[index(x,y)]=wear===0?'broken':wear===3?'cracked':wear===6?'moss':'clean';
      }
      if ((x + y) % 7 === 0) floor[index(x,y)] = 'cracked';
      if (x >= 5 && x <= 10 && y >= 4 && y <= 9) floor[index(x,y)] = 'dark';
      if ((x === 7 || x === 8) && y >= 7 && y <= 10) floor[index(x,y)] = 'sigil';
    }
    walls[index(8,0)] = 0;wallStyles[index(8,0)]='clean';
    return {
      schema: 1, area_id: AREA, tile_size: TILE, width: N, height: N,
      introSeen: false,
      floor, walls, wallStyles, wallVariants,
      objects: [
        { id:'temple_north_door', type:'door', x:8, y:0, r:0, open:false },
        { id:'sacrifice_altar', type:'altar', x:7, y:5, r:0 },
        { id:'brazier_west', type:'braziers', x:4, y:4, r:0 },
        { id:'brazier_east', type:'braziers', x:11, y:4, r:0 },
        { id:'pillar_west', type:'pillar', x:3, y:2, r:0 },
        { id:'pillar_east', type:'pillar', x:12, y:2, r:0 },
        { id:'pew_west', type:'pew', x:3, y:10, r:0 },
        { id:'pew_east', type:'pew', x:11, y:10, r:0 },
        { id:'candle_near_altar', type:'candle', x:13, y:9, r:0 }
      ],
      spawn: { x:8, y:12 },
      player: { x:8, y:12, facing:'north', form:'ghost' }
    };
  }
  let scene = fresh(), mode = 'walk', tool = 'place', category = 'relics',
      current = 'crystal', selectedId = null, corner = null, hover = null,
      previewRotation = 0,
      dirty = false, loaded = false, undoStack = [], redoStack = [], serial = 0;
  // Pandora-style architect wall brush state. Wall types do not change tile geometry.
  let wallFinish='clean',wallStroke=null,skipWallClick=false,
      selectedSprite='crystal_gold_bright',selectedWallTile=null;
  let architectClipboard=null;
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
  // Slow, irregular flicker uses the two approved gold crystal frames.
  // This is only presentation state; unused soul crystals stay full.
  let crystalBright = true, crystalFlickerTime = 1.2;
  function updateCrystalFlicker(dt) {
    if(!scene.objects.some(o=>o.type==='crystal'&&!o.spent))return false;
    crystalFlickerTime-=dt;
    if(crystalFlickerTime>0)return false;
    crystalFlickerTime=.9+Math.random()*2.3;
    const next=Math.random()<.5;
    const changed=next!==crystalBright;
    crystalBright=next;
    return changed;
  }

  // All cutscene actors are ephemeral; room geometry and saved editor objects stay separate.
  const CULT_POSITIONS=[[2,4],[13,4],[2,8],[13,8],[4,12],[11,12],[5,3],[10,3]];
  const womanImages={};
  if(typeof Image!=='undefined'){
    for(const d of ['north','east','south','west','kneeling']){
      const img=new Image();
      img.onload=()=>draw();img.onerror=()=>{};
      img.src='./assets/art/characters/crystal-woman/crystal_woman_'+(d==='kneeling'?'kneeling_north':d)+'.png';
      womanImages[d]=img;
    }
  }
  function actor(kind,x,y,facing='south'){return{kind,x,y,facing,route:[],index:0};}
  function route(a,points){a.route=points;a.index=0;}
  function moveActor(a,dt,speed=3.8){
    let travel=dt*speed;
    while(travel>0&&a.index<a.route.length){
      const p=a.route[a.index],dx=p[0]-a.x,dy=p[1]-a.y,d=Math.hypot(dx,dy);
      if(d<.001){a.x=p[0];a.y=p[1];a.index++;continue;}
      a.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');
      const z=Math.min(d,travel);a.x+=dx/d*z;a.y+=dy/d*z;travel-=z;
      if(z>=d-.001){a.x=p[0];a.y=p[1];a.index++;}
    }
    return a.index===a.route.length;
  }
  function phase(name,line){opening.phase=name;opening.time=0;message(line);}
  function setTempleDoor(open){
    const door=scene.objects.find(o=>o.id==='temple_north_door'&&o.type==='door');
    if(door)door.open=open;
  }
  function startOpening(){
    setTempleDoor(false);
    // Remove the obsolete prototype starter crystal only before its introductory ritual.
    scene.objects=scene.objects.filter(o=>!(o.id==='soul_crystal'&&o.type==='crystal'&&
      o.x===8&&o.y===9&&!scene.introSeen));
    opening={phase:'gather',time:0,sacrificed:false,ghostVisible:false,crystalPlaced:false,
      members:CULT_POSITIONS.map(([x,y],i)=>actor('member',x,y,i%2?'west':'east')),
      // The leader faces the altar from its foot; Devil and Lilith flank its sides.
      leader:actor('leader',8,7,'north'),devil:actor('devil',10,6,'west'),
      woman:actor('woman',5,6,'east')};
    rightMouseHeld=false;resetVisual();
    message('Cult members surround the altar. You lie bound, unable to move.');
  }
  function placeOpeningCrystal(){
    if(opening.crystalPlaced)return;
    opening.crystalPlaced=true;
    if(!scene.objects.some(o=>o.type==='crystal')){
      const crystal={id:'soul_crystal',type:'crystal',x:8,y:7,r:0,spent:false};
      if(canPlace(crystal))scene.objects.push(crystal);
    }
    dirty=true;
  }
  function updateOpening(dt){
    if(!opening)return;opening.time+=dt;
    switch(opening.phase){
      case 'gather':
        if(opening.time>=2)phase('prayer','The cult leader mutters: "The veil knows your name."');break;
      case 'prayer':
        if(opening.time>=2.5)phase('sacrifice','The cult leader announces: "Your life ends here."');break;
      case 'sacrifice':
        if(opening.time>=.45)opening.sacrificed=true;
        if(opening.time>=2.2){
          setTempleDoor(true);
          for(const m of opening.members){
            const edge=m.x<8?5:11;
            route(m,[[edge,m.y],[edge,2],[8,2],[8,-1]]);
          }
          route(opening.leader,[[10,7],[10,3],[8,3],[8,-1]]);
          phase('cultExit','The cult leader and the others leave through the north arch.');
        }break;
      case 'cultExit':{
        const gone=opening.members.map(m=>moveActor(m,dt,4.8)).every(Boolean);
        const leaderGone=moveActor(opening.leader,dt,4.2);
        if(gone&&leaderGone){
          setTempleDoor(false);
          opening.devil.facing='south';opening.woman.facing='south';
          opening.ghostVisible=true;
          // Let the ghost emerge farther down the central aisle (starter spawn: 8,12).
          scene.player.x=scene.spawn.x;scene.player.y=scene.spawn.y;
          scene.player.facing='north';resetVisual();
          phase('ghostRise','Your ghost rises in front of the altar. Your body remains behind.');
        }break;
      }
      case 'ghostRise':
        if(opening.time>=1.8)phase('devilSpeaks','The Devil stands on your right, Lilith on your left. Devil: "You\u2019re mine."');
        break;
      case 'devilSpeaks':
        if(opening.time>=1.5&&!opening.devilFollowUp){
          opening.devilFollowUp=true;
          message('The Devil whispers: "Death offers no escape."');
        }
        if(opening.time>=3){
          phase('devilExit','The Devil disappears where he stands. Lilith stays behind.');
        }break;
      case 'devilExit':
        if(opening.time>=.35){
          // The Devil vanishes without moving toward the temple door.
          route(opening.woman,[[5,7],[7,7],[8,7]]);
          phase('approach','Lilith approaches the altar.');
        }break;
      case 'approach':
        if(moveActor(opening.woman,dt,2.8)){
          opening.woman.facing='north';
          phase('kneel','Lilith prays: "In ash and silence, let one light remain."');
        }break;
      case 'kneel':
        if(opening.time>=5)phase('place','Lilith rises to place a soul crystal.');
        break;
      case 'place':
        if(opening.time>=.5){
          opening.woman.x=9;opening.woman.y=7;
          placeOpeningCrystal();
          route(opening.woman,[[10,7],[10,3],[8,3],[8,-1]]);
          phase('lilithExit','The golden soul crystal remains. Lilith leaves.');
        }break;
      case 'lilithExit':
        // Lilith opens the north door near its threshold and never closes it.
        if(opening.woman.y<=2.3)setTempleDoor(true);
        if(moveActor(opening.woman,dt,3.8)){
          setTempleDoor(true);
          opening=null;scene.introSeen=true;dirty=true;resetVisual();persistCharacter();
          message('Double-left-click the crystal to resurrect, or leave as a ghost.');
        }break;
    }
  }
  function drawCorpse(){
    if(scene.player.form!=='ghost')return;
    const altar=scene.objects.find(o=>o.type==='altar');if(!altar)return;
    const stillAlive=opening&&!opening.sacrificed;
    const picture=readyImage('characters/human/human_altar_'+(stillAlive?'alive':'dead')+'.png');
    // The lying body is scaled to match the 32-pixel NPCs around the altar.
    // Keep it centered on the real Architect footprint, even if rotated.
    const [altarWidth,altarHeight]=dims(altar);
    const bodyWidth=40,bodyHeight=20;
    const x=altar.x*TILE+Math.floor((altarWidth*TILE-bodyWidth)/2),
      y=altar.y*TILE+Math.floor((altarHeight*TILE-bodyHeight)/2);
    if(picture){ctx.drawImage(picture,x,y,bodyWidth,bodyHeight);return;}
    // Fallback block art uses the same reduced size when the sprite cannot load.
    pixel(ctx,'#261b24',x,y+3,bodyWidth,15);
    pixel(ctx,stillAlive?'#986771':'#694d5c',x+9,y+5,24,9);
    pixel(ctx,'#cc9a85',x+2,y+5,8,8);
  }
  function drawActor(a){
    if(a.y<0)return;
    const x=Math.round(a.x*TILE),y=Math.round(a.y*TILE);
    if(a.kind==='woman'){
      const frame=opening.phase==='kneel'?'kneeling':a.facing;
      const pic=womanImages[frame];
      if(pic&&pic.complete&&pic.naturalWidth>0){ctx.drawImage(pic,x,y,TILE,TILE);return;}
      pixel(ctx,'#ba4e2c',x+8,y+3,16,11);pixel(ctx,'#285740',x+7,y+15,18,15);
      return;
    }
    if(a.kind==='member'){
      // The approved member library supplies explicit cardinal files.
      // Use the file's named direction, avoiding atlas-frame ambiguity.
      const pic=readyImage('characters/cult-member/cult_member_'+a.facing+'.png');
      if(pic){ctx.drawImage(pic,x,y,TILE,TILE);return;}
    }else{
      const folder=a.kind==='devil'?'devil':'cult-leader';
      const file=a.kind==='devil'?'devil_spritesheet.png':'cult_leader_spritesheet.png';
      const pic=readyImage('characters/'+folder+'/'+file);
      if(pic){
        // Both approved sheets: south (front), west (left), east (right), north (back).
        const frame={south:0,west:1,east:2,north:3};
        ctx.drawImage(pic,frame[a.facing]*TILE,0,TILE,TILE,x,y,TILE,TILE);
        return;
      }
    }
    pixel(ctx,a.kind==='devil'?'#252027':'#392a30',x+8,y+3,16,27);
    pixel(ctx,a.kind==='devil'?'#a33e37':'#b4575b',x+12,y+9,8,9);
  }
  // Speech balloons are ephemeral Canvas overlays, not Architect room objects.
  function speechBubble(a,text,border='#ad9a84'){
    if(!a||a.y<0||!text)return;
    const lines=[];
    let line='';
    for(const word of text.split(/\s+/)){
      if(line&&(line+' '+word).length>25){lines.push(line);line=word;}
      else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);
    const width=Math.max(100,Math.min(218,Math.max(...lines.map(s=>s.length))*7+22));
    const height=lines.length*16+12;
    const cx=Math.round((a.x+.5)*TILE);
    const x=Math.max(4,Math.min(N*TILE-width-4,Math.round(cx-width/2)));
    // Keep dialogue clear of the speaker and the bound player on the altar.
    // A two-tile gap prevents the label from obscuring the ritual actors.
    const clearance=64;
    const y=Math.max(4,Math.round(a.y*TILE)-height-clearance);
    const tailX=Math.max(x+14,Math.min(x+width-14,cx));
    const tailBaseY=y+height-2;
    const tailTipY=tailBaseY+26;
    ctx.save();
    ctx.fillStyle='#151019';ctx.fillRect(x,y,width,height);
    ctx.strokeStyle=border;ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,width-2,height-2);
    // One long, pointed, character-aimed tail for every ritual dialogue box.
    // Draw the border first, then a smaller dark triangle for a crisp tapered edge.
    ctx.fillStyle=border;
    ctx.beginPath();
    ctx.moveTo(tailX-9,tailBaseY);
    ctx.lineTo(tailX+9,tailBaseY);
    ctx.lineTo(tailX,tailTipY);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='#151019';
    ctx.beginPath();
    ctx.moveTo(tailX-6,tailBaseY);
    ctx.lineTo(tailX+6,tailBaseY);
    ctx.lineTo(tailX,tailTipY-5);
    ctx.closePath();ctx.fill();
    // Open the bubble's lower border into the tail (no detached red stub).
    ctx.fillRect(tailX-5,tailBaseY-2,10,3);
    ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillStyle='#fff0d5';
    for(let i=0;i<lines.length;i++)ctx.fillText?.(lines[i],x+width/2,y+8+i*16);
    ctx.restore();
  }
  function drawOpening(){
    if(!opening)return;
    const p=opening.phase;
    if(['gather','prayer','sacrifice','cultExit'].includes(p)){
      for(const m of opening.members)drawActor(m);
      drawActor(opening.leader);
    }
    if(['ghostRise','devilSpeaks'].includes(p))drawActor(opening.devil);
    if(['ghostRise','devilSpeaks','devilExit','approach','kneel','place','lilithExit'].includes(p))
      drawActor(opening.woman);
    if(p==='prayer')
      speechBubble(opening.leader,'The veil knows your name.','#ba8e86');
    if(p==='sacrifice')
      speechBubble(opening.leader,'Your life ends here.','#bc575e');
    if(p==='devilSpeaks')
      speechBubble(opening.devil,opening.time<1.5?"You're mine.":'Death offers no escape.','#c4464b');
    if(p==='kneel')
      speechBubble(opening.woman,'In ash and silence, let one light remain.','#c7ae68');
  }
  function beginResurrection(crystal) {
    // The specific crystal selected by the valid double-click empties immediately.
    if(crystal&&crystal.type==='crystal'&&!crystal.spent){
      crystal.spent=true;dirty=true;
    }
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
      // Closed doors retain their canonical gate semantics.
      const blocking=o.type==='door'?!o.open:
        typeof o.solidOverride==='boolean'?o.solidOverride:CATALOG[o.type].solid;
      if(!blocking)return false;
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
    // Hand-selected wall geometry takes precedence. Untouched cells keep
    // automatic cardinal joins, so existing temple walls remain unchanged.
    const exact=scene.wallVariants?.[index(x,y)];
    if(exact&&Object.hasOwn(WALL_TILE_PIECES,exact)){
      const image=readyImage('temple/walls/'+exact+'.png');
      if(image)return image;
    }
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
    const finish=scene.wallStyles?.[index(x,y)]||'clean';
    const path='temple/walls/'+name+'_'+face;
    return (finish==='clean'?null:readyImage(path+'_'+finish+'.png'))||readyImage(path+'.png');
  }
  function art(g,o) {
    if(o.type==='scenery'){
      const entry=ARCHITECT_SPRITES[o.spriteId];
      if(!entry)return;
      const face=direction[o.r||0]||'north';
      const path=entry.path||(entry.prefix?entry.prefix+face+'.png':entry.sheet);
      const picture=readyImage(entry.sheet||path),size=entry.size||32;
      const x=(o.x+.5)*TILE,y=(o.y+.5)*TILE;
      if(picture&&typeof g.drawImage==='function'){
        g.save();g.translate(x,y);
        if(entry.group!=='actor')g.rotate((o.r||0)*Math.PI/2);
        if(entry.sheet){
          const frame={south:0,west:1,east:2,north:3}[face];
          g.drawImage(picture,frame*32,0,32,32,-size/2,-size/2,size,size);
        }else g.drawImage(picture,-size/2,-size/2,size,size);
        g.restore();
      }else pixel(g,entry.group==='crystal'?'#bc9b66':'#8a7c92',x-6,y-8,12,16);
      return;
    }
    // A soul crystal occupies a tile for interaction, but its visible crystal is
    // far smaller than the 32x32 player. Never stretch it to fill the whole tile.
    if(o.type==='crystal'){
      const filename=o.spent?'crystal_silver_depleted.png'
        :'crystal_gold_'+(crystalBright?'bright':'dim')+'.png';
      const picture=readyImage('crystals/'+filename);
      const crystalSize=24,offset=(TILE-crystalSize)/2;
      if(picture){
        g.drawImage(picture,o.x*TILE+offset,o.y*TILE+offset,crystalSize,crystalSize);
      }else{
        // Small emergency fallback, never the former oversized purple crystal.
        const color=o.spent?'#b4b4bd':crystalBright?'#ffdf54':'#a38325';
        pixel(g,color,o.x*TILE+13,o.y*TILE+10,6,13);
      }
      return;
    }
    const picture=objectImage(o),size=dims(o);
    // Approved newer torch-and-flame artwork from the original temple asset sheet.
    if(o.type==='braziers'){
      const sheet=readyImage('temple/Demon Killer Pixel Art Tile Sheet.png');
      if(sheet){g.drawImage(sheet,331,590,147,143,o.x*TILE,o.y*TILE,TILE,TILE);return;}
    }
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
    drawCorpse();drawOpening();if(!opening||opening.ghostVisible)playerSprite();
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
      if(tool==='place'&&CATALOG[current]||tool==='paste'&&architectClipboard){
        const preview=tool==='paste'
          ?{...architectClipboard,id:'__architect_preview__',x:hover.x,y:hover.y}
          :{id:'__architect_preview__',type:current,x:hover.x,y:hover.y,
            r:previewRotation,open:true,spent:false,...(current==='scenery'?{spriteId:selectedSprite}:{})};
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
    $('lifeState').textContent=opening&&!opening.sacrificed?'ALIVE · sacrifice':scene.player.form==='ghost'?'GHOST · secret path':'RESURRECTED · mortal path';
    $('lifeState').style.color=scene.player.form==='ghost'?'#b9c6f4':'#f5b7bb';
    $('objectCount').textContent=String(scene.objects.length);
    const o=objectAtId(selectedId);
    const wallAt=hover&&scene.walls[index(hover.x,hover.y)];
    $('itemInfo').textContent=o?(o.type==='scenery'?ARCHITECT_SPRITES[o.spriteId]?.label||'Staged Sprite'
      :CATALOG[o.type].label)+' ('+o.x+', '+o.y+')'
      :wallAt?'Wall: '+(scene.wallStyles?.[index(hover.x,hover.y)]||'clean')+' ('+hover.x+', '+hover.y+')':'None';
    $('saveState').textContent=dirty?'Unsaved edits':loaded?'Saved layout':'Starter scene';
    updateObjectInspector();
    $('modeLabel').textContent=mode==='walk'?'WALK MODE':'ARCHITECT MODE';
    $('coordTop').textContent=hover?'X '+hover.x+' · Y '+hover.y:'16 × 16 · 32 PX';
    $('selectedTool').textContent=tool.toUpperCase();
    if(typeof updateUoButtonState==='function')updateUoButtonState();
    if(wallStroke&&mode==='edit'){
      ctx.save();ctx.globalAlpha=.32;ctx.fillStyle='#efc68c';
      for(const tile of wallStroke.cells)ctx.fillRect((tile%N)*TILE,(Math.floor(tile/N))*TILE,TILE,TILE);
      ctx.restore();
    }
    $('walkMode').classList.toggle('active',mode==='walk');$('editMode').classList.toggle('active',mode==='edit');
    if(typeof updateArchitectTabs==='function')updateArchitectTabs();
    $('walkMode').setAttribute('aria-pressed',String(mode==='walk'));$('editMode').setAttribute('aria-pressed',String(mode==='edit'));
  }
  function updateObjectInspector(){
    const selected=objectAtId(selectedId),fields=$('inspectorFields');
    fields.hidden=!selected;
    $('inspectorObjectLabel').textContent=selected
      ?(selected.type==='scenery'?ARCHITECT_SPRITES[selected.spriteId]?.label||'Staged Sprite':
        CATALOG[selected.type].label)+' · '+selected.id
      :'Select an object using Select / Move.';
    for(const id of ['inspectorApply','inspectorCopy','inspectorFront','inspectorBack'])
      $(id).disabled=!selected;
    $('inspectorPaste').disabled=!architectClipboard;
    if(!selected)return;
    const values={inspectorX:selected.x,inspectorY:selected.y,inspectorFacing:selected.r||0,
      inspectorSolid:typeof selected.solidOverride==='boolean'?
        (selected.solidOverride?'solid':'passable'):'default'};
    for(const [id,value] of Object.entries(values))
      if(document.activeElement!==$(id))$(id).value=String(value);
  }
  function palette() {
    const list=$('palette');list.replaceChildren();$('paletteTitle').textContent=GROUPS[category];
    const all=category==='walls'?
        [...Object.entries(WALL_FINISHES),...Object.entries(WALL_TILE_PIECES)]
      :category==='floors'?Object.entries(FLOOR)
      :category==='library'?Object.entries(ARCHITECT_SPRITES)
      :Object.entries(CATALOG).filter(([,a])=>a.category===category);
    const query=$('assetSearch').value.trim().toLowerCase();
    const entries=all.filter(([name,entry])=>(name+' '+entry.label).toLowerCase().includes(query));
    for(const [key,entry] of entries){
      const b=document.createElement('button');b.type='button';
      b.className=(category==='walls'?
          (selectedWallTile?selectedWallTile===key:wallFinish===key)
        :category==='library'?selectedSprite===key:current===key)?'active':'';
      const mini=document.createElement('canvas');mini.width=32;mini.height=32;mini.setAttribute('aria-hidden','true');
      const c=mini.getContext('2d');c.imageSmoothingEnabled=false;
      if(category==='floors'){
        c.fillStyle=entry.color;c.fillRect(0,0,32,32);
        c.strokeStyle='#8e6676';c.strokeRect(2,2,28,28);
        if(key==='sigil'){c.fillStyle='#bf748e';c.fillRect(15,8,3,16);c.fillRect(9,15,16,2);}
      }else if(category==='walls'){
        const name=Object.hasOwn(WALL_TILE_PIECES,key)
          ?'temple/walls/'+key+'.png'
          :'temple/walls/wall_straight_north'+(key==='clean'?'':'_'+key)+'.png';
        const image=readyImage(name);
        if(image&&typeof c.drawImage==='function')c.drawImage(image,0,0,32,32);
        else{c.fillStyle=entry.color;c.fillRect(3,7,26,18);c.strokeStyle='#201921';c.strokeRect(3,7,26,18);}
      }else if(category==='library'){
        art(c,{type:'scenery',spriteId:key,x:0,y:0,r:0});
      }else{
        const base=CATALOG[key];c.scale(1/base.w,1/base.h);art(c,{type:key,x:0,y:0,r:0,open:false});
      }
      const span=document.createElement('span');span.textContent=entry.label;
      b.append(mini,span);b.addEventListener('click',()=>{
        if(category==='walls'){
          if(Object.hasOwn(WALL_TILE_PIECES,key)){
            selectedWallTile=key;wallFinish=WALL_TILE_PIECES[key].finish;
          }else{selectedWallTile=null;wallFinish=key;}
          tool='wall';$('tool').value=tool;
        }else{
          current=category==='library'?'scenery':key;
          if(category==='library')selectedSprite=key;
          previewRotation=0;
          if(category==='floors'&&tool==='place')$('tool').value=tool='floor';
          if(category!=='floors'&&(['floor','fill','rectangle','wall','wallErase','wallLine','wallRectangle','paste'].includes(tool)))
            $('tool').value=tool='place';
        }
        palette();draw();message('Selected '+entry.label+'. Click a grid coordinate in Architect Mode.');
      });list.append(b);
    }
    $('wallFinishLabel').textContent=selectedWallTile
      ?'EXACT WALL · '+WALL_TILE_PIECES[selectedWallTile].label.toUpperCase()
      :'AUTO JOIN · '+WALL_FINISHES[wallFinish].label.toUpperCase();
    $('uoAssetCount').textContent=entries.length+' TILES';
  }
  function setMode(next) {
    rightMouseHeld=false;
    resetVisual();
    mode=next;selectedId=null;corner=null;wallStroke=null;skipWallClick=false;
    $('architectWindow').hidden=next!=='edit';
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
    if(nx===8&&ny===0&&!scene.introSeen){message('I cannot leave.');return false;}
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
    if(obj.type==='door'&&!scene.introSeen){message('I cannot leave.');return;}
    if(obj.type==='braziers'&&p.form==='ghost'){message("The fire doesn't affect me.");return;}
    if(obj.type==='pew'&&p.form==='ghost'){message('Ghosts need no rest.');return;}
    if(obj.type==='door') {
      obj.open=!obj.open;dirty=true;draw();persistCharacter();
      message('Iron arch '+(obj.open?'opened':'closed')+'.');return;
    }
    if(obj.type==='crystal'&&!obj.spent&&p.form==='ghost') {
      // A normal click inspects; only a deliberate double click resurrects.
      if (!doubleClick) {message('A glowing gold crystal.');return;}
      beginResurrection(obj);draw();return;
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
      if(!canStand(tx,ty)||(tx===8&&ty===0&&!scene.introSeen))return false;
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
    const crystalChanged=updateCrystalFlicker(dt);
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
    if(crystalChanged)draw();
    requestAnimationFrame(advanceFrame);
  }
  function idFor(type){serial+=1;return type+'_'+Date.now().toString(36)+'_'+serial.toString(36);}
  function paintWallCells(cells,erase=false){
    return transact(()=>{
      if(!scene.wallStyles)scene.wallStyles=Array(COUNT).fill('clean');
      if(!scene.wallVariants)scene.wallVariants=Array(COUNT).fill(null);
      for(const [x,y] of cells){
        if(!inside(x,y))continue;
        const i=index(x,y);
        if(erase){
          if(scene.walls[i]){
            scene.walls[i]=0;scene.wallStyles[i]='clean';scene.wallVariants[i]=null;
          }
        }else if(!objectAt(x,y)){
          scene.walls[i]=1;scene.wallStyles[i]=wallFinish;
          scene.wallVariants[i]=selectedWallTile;
        }
      }
    },(erase?'Removed':'Painted '+WALL_FINISHES[wallFinish].label)+' wall tiles ('+cells.length+' selected).');
  }
  function applyEdit(x,y){
    const here=objectAt(x,y),i=index(x,y);
    if(tool==='pick'){
      if(scene.walls[i]&&!here){
        wallFinish=scene.wallStyles?.[i]||'clean';
        selectedWallTile=scene.wallVariants?.[i]||null;
        category='walls';tool='wall';
        $('category').value=category;$('tool').value=tool;palette();draw();
        message('Eyedropper: '+WALL_FINISHES[wallFinish].label+' wall.');return;
      }
      if(here){
        current=here.type;category=CATALOG[here.type].category;tool='place';
        if(here.type==='scenery')selectedSprite=here.spriteId;
        $('category').value=category;$('tool').value=tool;
        palette();draw();message('Eyedropper: '+(here.type==='scenery'?
          ARCHITECT_SPRITES[here.spriteId].label:CATALOG[here.type].label));
      }
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
        else if(scene.walls[i]){
          scene.walls[i]=0;
          if(scene.wallStyles)scene.wallStyles[i]='clean';
          if(scene.wallVariants)scene.wallVariants[i]=null;
        }
      },'Removed '+(here?CATALOG[here.type].label:'wall')+' at ('+x+', '+y+').');selectedId=null;return;
    }
    if(tool==='wall'||tool==='wallErase'){
      paintWallCells([[x,y]],tool==='wallErase');return;
    }
    if(tool==='wallLine'||tool==='wallRectangle'){
      if(!corner){corner={x,y};draw();message('First wall corner ('+x+', '+y+'). Choose the second point.');return;}
      if(tool==='wallLine'&&x!==corner.x&&y!==corner.y){
        message('Straight wall runs cannot be diagonal. Choose a point in the same row or column.');return;
      }
      const cells=[],left=Math.min(corner.x,x),right=Math.max(corner.x,x),
        top=Math.min(corner.y,y),bottom=Math.max(corner.y,y);
      for(let yy=top;yy<=bottom;yy++)for(let xx=left;xx<=right;xx++){
        if(tool==='wallLine'||xx===left||xx===right||yy===top||yy===bottom)cells.push([xx,yy]);
      }
      paintWallCells(cells);corner=null;draw();return;
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
    if(tool==='paste'){
      if(!architectClipboard)return message('Copy an object before pasting.');
      const obj={...clone(architectClipboard),id:idFor(architectClipboard.type),x,y};
      const accepted=transact(()=>{
        if(canPlace(obj))scene.objects.push(obj);
      },'Pasted '+CATALOG[obj.type].label+' at ('+x+', '+y+').');
      if(accepted){selectedId=obj.id;draw();}
      return;
    }
    if(tool==='place'){
      if(!CATALOG[current])return message('Choose a relic, structure or prop from the palette.');
      const obj={id:idFor(current),type:current,x,y,r:previewRotation};
      if(current==='scenery')obj.spriteId=selectedSprite;
      if(current==='door')obj.open=true;
      if(current==='crystal')obj.spent=false;
      transact(()=>{if(canPlace(obj))scene.objects.push(obj);},'Placed '+CATALOG[current].label+' at ('+x+', '+y+').');return;
    }
  }
  function applyInspector(){
    const o=objectAtId(selectedId);
    if(!o)return message('Select an object before editing properties.');
    const x=Number($('inspectorX').value),y=Number($('inspectorY').value),
      r=Number($('inspectorFacing').value),collision=$('inspectorSolid').value;
    if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(r)||r<0||r>3||
      !['default','solid','passable'].includes(collision))
      return message('Inspector rejected invalid coordinates, rotation or collision.');
    if(o.type==='door'&&collision!=='default')
      return message('Door collision follows its open/closed state.');
    const candidate={...o,x,y,r};
    delete candidate.solidOverride;
    if(collision!=='default')candidate.solidOverride=collision==='solid';
    if(!canPlace(candidate,o.id))
      return message('Inspector destination blocked or outside this room.');
    transact(()=>{
      const target=objectAtId(selectedId);
      Object.assign(target,candidate);
      if(collision==='default')delete target.solidOverride;
    },'Updated '+CATALOG[o.type].label+' at ('+x+', '+y+').');
  }
  function copySelected(){
    const o=objectAtId(selectedId);
    if(!o)return message('Select an object to copy.');
    architectClipboard=clone(o);
    tool='paste';$('tool').value=tool;corner=null;
    draw();message('Copied '+CATALOG[o.type].label+'. Click a free tile to paste.');
  }
  function bringSelected(front){
    const o=objectAtId(selectedId);
    if(!o)return message('Select an object to change draw order.');
    const i=scene.objects.findIndex(item=>item.id===o.id);
    if(i===(front?scene.objects.length-1:0))
      return message('Selected object is already at that end of the drawing order.');
    transact(()=>{
      const [item]=scene.objects.splice(i,1);
      if(front)scene.objects.push(item);else scene.objects.unshift(item);
    },front?'Object moved to front.':'Object sent to back.');
  }
  function rotateSelected() {
    const obj=objectAtId(selectedId);
    // A hand-placed corner, end or other wall art can rotate cardinally too.
    if(!obj&&hover&&scene.walls[index(hover.x,hover.y)]){
      const i=index(hover.x,hover.y),key=scene.wallVariants?.[i];
      if(key&&Object.hasOwn(WALL_TILE_PIECES,key)){
        const item=WALL_TILE_PIECES[key],faces=['north','east','south','west'];
        const next='wall_'+item.shape+'_'+faces[(faces.indexOf(item.face)+1)%4]+
          (item.finish==='clean'?'':'_'+item.finish);
        transact(()=>{scene.wallVariants[i]=next;},'Rotated wall art to '+faces[(faces.indexOf(item.face)+1)%4]+'.');
        selectedWallTile=next;return;
      }
      return message('Select an exact wall piece to rotate; automatic joints follow their neighbors.');
    }
    if(!obj)return message('Select an object or hover over a hand-placed wall to rotate.');
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
      if('solidOverride' in o&&(typeof o.solidOverride!=='boolean'||o.type==='door'))
        throw Error('Invalid custom collision property.');
      if(o.type==='scenery'&&(!Object.hasOwn(ARCHITECT_SPRITES,o.spriteId)))
        throw Error('Unknown staged sprite asset.');
    }
    if(!data.spawn||!inside(data.spawn.x,data.spawn.y)||!data.player||!inside(data.player.x,data.player.y))
      throw Error('Invalid player or spawn coordinates.');
    if(!['ghost','living'].includes(data.player.form)||!['north','south','east','west'].includes(data.player.facing))
      throw Error('Unknown player state.');
    if ('introSeen' in data && typeof data.introSeen!=='boolean')throw Error('Invalid intro completion flag.');
    if('wallStyles' in data && (!Array.isArray(data.wallStyles)||data.wallStyles.length!==COUNT||
      !data.wallStyles.every(v=>Object.hasOwn(WALL_FINISHES,v))))
      throw Error('Invalid wall finish records.');
    if('wallVariants' in data&&(!Array.isArray(data.wallVariants)||data.wallVariants.length!==COUNT||
      !data.wallVariants.every(v=>v===null||Object.hasOwn(WALL_TILE_PIECES,v))))
      throw Error('Invalid manually selected wall art.');
    const restored=clone(data);
    if(!restored.wallStyles)restored.wallStyles=Array(COUNT).fill('clean');
    if(!restored.wallVariants)restored.wallVariants=Array(COUNT).fill(null);
    return restored;
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
    if(mode==='edit'&&skipWallClick){skipWallClick=false;return;}
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
    if(mode==='edit'&&e.button===0&&(tool==='wall'||tool==='wallErase')){
      const p=mouseTile(e);
      if(p){wallStroke={type:tool,cells:new Set([index(p.x,p.y)])};hover=p;draw();}
      return;
    }
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
  function completeWallStroke(){
    if(!wallStroke)return;
    const stroke=wallStroke;wallStroke=null;
    const cells=[...stroke.cells].map(i=>[i%N,Math.floor(i/N)]);
    paintWallCells(cells,stroke.type==='wallErase');skipWallClick=true;
  }
  canvas.addEventListener('mouseup',e=>{
    if(e.button===2)stopRightMovement();
    if(e.button===0)completeWallStroke();
  });
  if(typeof window!=='undefined'){
    window.addEventListener('mouseup',e=>{
      if(e.button===2)stopRightMovement();
      if(e.button===0)completeWallStroke();
    });
    window.addEventListener('blur',()=>{stopRightMovement();wallStroke=null;skipWallClick=false;});
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
    if(wallStroke){
      wallStroke.cells.add(index(p.x,p.y));hover=p;draw();return;
    }
    if(!hover||p.x!==hover.x||p.y!==hover.y){hover=p;draw();}
  });
  canvas.addEventListener('mouseleave',()=>{hover=null;stopRightMovement();draw();});
  document.addEventListener('keydown',e=>{
    const name=e.target?.tagName;
    if(name==='INPUT'||name==='SELECT'||name==='TEXTAREA')return;
    if($('cultJournal').hidden===false)return; // Ignore gameplay keys only while the cult overlay is visibly open.
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
  // A single floating construction tool replaces the former fixed Architect sidebar.
  // Layout preferences are local UI state, never part of the room or player save.
  const architectWindow=$('architectWindow'),architectBody=$('architectBody'),
    architectTitle=$('architectDrag');
  // New UI preference key: the owner rejected the former tall sidebar dimensions.
  const ARCHITECT_WINDOW_KEY='dkSoftworks.demonkiller.uoHouseToolbar.v2';
  let architectDragging=null,architectView='assets';
  function saveArchitectWindow(){
    try {
      const rect=architectWindow.getBoundingClientRect();
      localStorage.setItem(ARCHITECT_WINDOW_KEY,JSON.stringify({
        left:parseInt(architectWindow.style.left||'15',10),
        top:parseInt(architectWindow.style.top||'103',10),
        width:Math.max(300,Math.round(rect.width)),
        height:Math.max(100,Math.round(rect.height)),
        minimized:architectBody.hidden
      }));
    }catch(error){ /* Restrictive browsers may disable local storage. */ }
  }
  try {
    const saved=JSON.parse(localStorage.getItem(ARCHITECT_WINDOW_KEY)||'null');
    if(saved&&typeof saved==='object'){
      const maxX=Math.max(8,(window.innerWidth||1200)-100),maxY=Math.max(8,(window.innerHeight||900)-52);
      const left=Number(saved.left),top=Number(saved.top);
      if(Number.isFinite(left)&&Number.isFinite(top)){
        architectWindow.style.left=Math.max(0,Math.min(maxX,left))+'px';
        architectWindow.style.top=Math.max(0,Math.min(maxY,top))+'px';
      }
      if(Number.isFinite(saved.width)&&saved.width>=300&&saved.width<=1100)
        architectWindow.style.width=Math.min(saved.width,window.innerWidth||1200)+'px';
      if(Number.isFinite(saved.height)&&saved.height>=140&&saved.height<=1000)
        architectWindow.style.height=Math.min(saved.height,window.innerHeight||900)+'px';
      architectBody.hidden=Boolean(saved.minimized);
    }
  }catch(error){ /* Invalid UI preferences never affect world state. */ }
  function updateArchitectTabs(){
    const buttons=architectWindow.querySelectorAll?.('[data-architect-category],[data-architect-view]')||[];
    for(const button of buttons){
      const active=architectView==='assets'&&button.dataset?.architectCategory===category
        ||architectView===button.dataset?.architectView;
      button.classList.toggle('active',Boolean(active));
      button.setAttribute('aria-pressed',String(Boolean(active)));
    }
  }
  function architectScreen(view){
    architectView=view;
    $('architectAssetTools').hidden=view!=='assets';
    $('architectAdminInfo').hidden=view!=='admin';
    $('architectQuestInfo').hidden=view!=='quests';
    updateArchitectTabs();
  }
  const tabButtons=architectWindow.querySelectorAll?.('[data-architect-category],[data-architect-view]')||[];
  for(const button of tabButtons){
    button.addEventListener('click',()=>{
      if(button.dataset.architectView){architectScreen(button.dataset.architectView);return;}
      const next=button.dataset.architectCategory;
      if(!Object.hasOwn(GROUPS,next))return;
      category=next;$('category').value=category;$('assetSearch').value='';
      current=category==='floors'?'stone'
        :category==='library'?'scenery'
        :Object.keys(CATALOG).find(k=>CATALOG[k].category===category);
      if(category==='walls'){tool='wall';$('tool').value=tool;}
      else if(category==='floors'){tool='floor';$('tool').value=tool;}
      else{tool='place';$('tool').value=tool;}
      corner=null;selectedId=null;architectScreen('assets');
      palette();draw();message('Architect category: '+GROUPS[category]+'.');
    });
  }
  $('architectClose').addEventListener('click',()=>setMode('walk'));
  $('architectMinimize').addEventListener('click',()=>{
    architectBody.hidden=!architectBody.hidden;
    $('architectMinimize').setAttribute('aria-expanded',String(!architectBody.hidden));
    architectWindow.classList.toggle('minimized',architectBody.hidden);
    saveArchitectWindow();
  });
  if(architectBody.hidden)architectWindow.classList.add('minimized');
  architectTitle.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target?.closest?.('button'))return;
    architectDragging={x:e.clientX,y:e.clientY,
      left:parseFloat(architectWindow.style.left)||15,
      top:parseFloat(architectWindow.style.top)||103};
    e.preventDefault?.();
  });
  document.addEventListener('pointermove',e=>{
    if(!architectDragging)return;
    const maxX=Math.max(0,(window.innerWidth||1200)-80);
    const maxY=Math.max(0,(window.innerHeight||900)-40);
    architectWindow.style.left=Math.round(Math.max(0,Math.min(maxX,
      architectDragging.left+e.clientX-architectDragging.x)))+'px';
    architectWindow.style.top=Math.round(Math.max(0,Math.min(maxY,
      architectDragging.top+e.clientY-architectDragging.y)))+'px';
  });
  document.addEventListener('pointerup',()=>{
    if(architectDragging){architectDragging=null;saveArchitectWindow();}
  });
  $('walkMode').addEventListener('click',()=>setMode('walk'));
  $('editMode').addEventListener('click',()=>{architectScreen('assets');setMode('edit');});
  $('tool').addEventListener('change',e=>{
    tool=e.target.value;corner=null;selectedId=null;wallStroke=null;
    if(['wall','wallErase','wallLine','wallRectangle'].includes(tool)){
      category='walls';$('category').value=category;palette();
    }
    draw();message('Architect tool: '+e.target.selectedOptions[0].textContent+'.');
  });
  $('category').addEventListener('change',e=>{
    category=e.target.value;previewRotation=0;$('assetSearch').value='';
    if(category==='floors'){current='stone';tool='floor';$('tool').value=tool;}
    else if(category==='walls'){tool='wall';$('tool').value=tool;}
    else if(category==='library'){current='scenery';tool='place';$('tool').value=tool;}
    else {
      current=Object.keys(CATALOG).find(k=>CATALOG[k].category===category);
      if(['floor','fill','rectangle','wall','wallErase','wallLine','wallRectangle','paste'].includes(tool)){
        tool='place';$('tool').value=tool;
      }
    }
    palette();draw();
  });
  $('assetSearch').addEventListener('input',palette);
  for(const [id,action] of [['wallBrush','wall'],['wallLineButton','wallLine'],
      ['wallOutlineButton','wallRectangle'],['wallEraseButton','wallErase']]){
    $(id).addEventListener('click',()=>{
      tool=action;category='walls';$('category').value=category;$('tool').value=tool;
      corner=null;wallStroke=null;palette();draw();message('Wall tool: '+action+'.');
    });
  }
  $('inspectorApply').addEventListener('click',applyInspector);
  $('inspectorCopy').addEventListener('click',copySelected);
  $('inspectorPaste').addEventListener('click',()=>{
    if(!architectClipboard)return message('Copy an object first.');
    tool='paste';$('tool').value=tool;draw();
    message('Paste mode: click a free tile in the room.');
  });
  $('inspectorFront').addEventListener('click',()=>bringSelected(true));
  $('inspectorBack').addEventListener('click',()=>bringSelected(false));

  // Approved master UI atlas, sampled as exact CSS sprites. No invented assets.
  const UI_ATLAS='./assets/art/dkarchitect/ui/Medieval%20Architect%20UI%20Sprite%20Sheet.png';
  const UI_RECTS={
    banner:[68,65,104,162,.43],title:[1785,404,368,81,.32],
    help:[1870,12,57,52,.48],minimize:[1935,13,57,51,.48],
    close:[2066,12,56,52,.48],
    cursor:[18,487,67,58,.57],cube:[90,486,66,60,.57],
    move:[160,486,68,59,.57],rotate:[229,486,69,60,.57],
    paint:[301,487,67,58,.57],copy:[374,487,67,59,.57],
    delete:[449,487,66,58,.57],search:[521,487,65,58,.57],
    house:[593,487,66,58,.57],stairs:[664,487,67,58,.57],
    levels:[736,487,68,58,.57],settings:[808,487,69,58,.57],
    eye:[18,553,66,58,.48],add:[90,553,65,58,.48],
    undo:[301,553,66,58,.57],redo:[373,553,67,58,.57],
    lock:[593,554,65,58,.48],
    leftArrow:[900,490,39,97,.47],rightArrow:[981,490,40,97,.47]
  };
  // Rendering the supplied sprite sheet as CSS backgrounds avoids copying
  // questionable auto-crops from the prior generated cut-out bundle.
  for(const artNode of document.querySelectorAll?.('[data-uo-art]')||[]){
    const dimensions=UI_RECTS[artNode.dataset.uoArt];if(!dimensions)continue;
    const [x,y,w,h,scale]=dimensions;
    artNode.style.backgroundImage='url("'+UI_ATLAS+'")';
    artNode.style.backgroundSize=(2172*scale)+'px '+(724*scale)+'px';
    artNode.style.backgroundPosition=(-x*scale)+'px '+(-y*scale)+'px';
    artNode.style.backgroundRepeat='no-repeat';
    artNode.style.width=Math.ceil(w*scale)+'px';
    artNode.style.height=Math.ceil(h*scale)+'px';
  }

  // Nine-slice border sampled from the owner-approved window frame in the
  // transparent master. The stones retain their original pixelwork at every
  // viewport width; there is no painted CSS imitation over the art browser.
  const frameCanvas=$('uoFrameSkin'),frameHost=frameCanvas.parentElement;
  if(frameCanvas&&frameHost&&typeof Image!=='undefined'){
    const frameTexture=new Image();
    const paintApprovedFrame=()=>{
      if(!frameTexture.complete||!frameTexture.naturalWidth)return;
      const w=Math.max(120,Math.round(frameHost.clientWidth||800)),
        h=Math.max(72,Math.round(frameHost.clientHeight||105));
      if(frameCanvas.width!==w)frameCanvas.width=w;
      if(frameCanvas.height!==h)frameCanvas.height=h;
      const g=frameCanvas.getContext('2d');if(!g)return;
      g.imageSmoothingEnabled=false;g.clearRect(0,0,w,h);
      const sx=[517,517+50,517+1333-50],sw=[50,1333-100,50],
        sy=[62,62+48,62+237-48],sh=[48,237-96,48];
      const dx=[0,24,w-24],dw=[24,Math.max(0,w-48),24],
        dy=[0,20,h-20],dh=[20,Math.max(0,h-40),20];
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)
        g.drawImage(frameTexture,sx[col],sy[row],sw[col],sh[row],
          dx[col],dy[row],dw[col],dh[row]);
    };
    frameTexture.onload=paintApprovedFrame;
    frameTexture.src=UI_ATLAS;
    if(typeof ResizeObserver!=='undefined'){
      new ResizeObserver(paintApprovedFrame).observe(frameHost);
    }else if(typeof window!=='undefined'){
      window.addEventListener('resize',paintApprovedFrame);
    }
  }

  function updateUoButtonState(){
    const map={uoSelect:'select',uoMove:'select',uoPlace:'place',
      uoWallBrush:'wall',uoRoom:'wallRectangle',uoFloor:'floor',
      uoDelete:'erase',uoPick:'pick'};
    for(const [id,state] of Object.entries(map))
      $(id).classList.toggle('active',mode==='edit'&&tool===state);
  }
  function uoTool(id,next){
    $(id).addEventListener('click',()=>{
      if(next==='wall'||next==='wallRectangle'){
        category='walls';$('category').value=category;palette();
      }else if(next==='floor'){
        category='floors';current='stone';$('category').value=category;palette();
      }
      tool=next;$('tool').value=next;corner=null;selectedId=null;
      draw();message('Architect '+next+' tool ready. Click a tile in the room.');
    });
  }
  for(const [id,toolName] of [
    ['uoSelect','select'],['uoMove','select'],['uoPlace','place'],
    ['uoWallBrush','wall'],['uoRoom','wallRectangle'],['uoFloor','floor'],
    ['uoDelete','erase'],['uoPick','pick']])uoTool(id,toolName);
  $('uoRotate').addEventListener('click',rotateSelected);
  $('uoCopy').addEventListener('click',copySelected);
  $('uoUndo').addEventListener('click',undo);
  $('uoRedo').addEventListener('click',redo);
  $('uoInspect').addEventListener('click',checkAccess);
  const paletteViewport=$('uoPaletteViewport');
  $('uoPrev').addEventListener('click',()=>{
    paletteViewport.scrollBy?.({left:-365,behavior:'smooth'});
  });
  $('uoNext').addEventListener('click',()=>{
    paletteViewport.scrollBy?.({left:365,behavior:'smooth'});
  });
  function showUoDetails(view='assets'){
    architectBody.hidden=false;architectWindow.classList.remove('minimized');
    $('uoAdvanced').hidden=false;
    architectScreen(view);
    $('architectMinimize').setAttribute('aria-expanded','true');
  }
  $('uoSettings').addEventListener('click',()=>showUoDetails('assets'));
  $('uoHelp').addEventListener('click',()=>showUoDetails('assets'));
  $('uoAdmin').addEventListener('click',()=>showUoDetails('admin'));
  $('uoQuest').addEventListener('click',()=>showUoDetails('quests'));
  $('uoHideAdvanced').addEventListener('click',()=>{
    $('uoAdvanced').hidden=true;architectScreen('assets');
  });
  const DESIGN_BACKUP_KEY='dkSoftworks.demonkiller.architectLocalBackup.v1';
  $('uoBackup').addEventListener('click',()=>{
    try{localStorage.setItem(DESIGN_BACKUP_KEY,JSON.stringify(scene));
      message('Local design backup stored. This is not a server backup.');}
    catch(error){message('Local backup failed: '+error.message);}
  });
  $('uoRestore').addEventListener('click',()=>{
    try{
      const saved=localStorage.getItem(DESIGN_BACKUP_KEY);
      if(!saved)return message('No local Architect backup exists.');
      const draft=validate(JSON.parse(saved));
      transact(()=>{scene=draft;selectedId=null;corner=null;},
        'Restored local Architect backup; press COMMIT to save the restored layout.');
    }catch(error){message('Backup restore rejected: '+error.message);}
  });
  $('uoCommit').addEventListener('click',()=>{
    save();message('Committed locally in this browser. World-server commit is not implemented yet.');
  });
  $('uoRevert').addEventListener('click',()=>{
    load();message('Reverted to the last locally saved room, if one was available.');
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
