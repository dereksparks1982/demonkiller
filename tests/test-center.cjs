'use strict';
/* Standalone Demon Killer test center: Node.js contract and simulated interactions.
 * Run from repository root: node tests/test-center.cjs
 * This is not a headless visual browser test.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('test-center.html'),css=read('test-center.css'),js=read('test-center.js');
assert(html.includes('<canvas id="room" width="512" height="512"'));
for(const id of ['walkMode','editMode','room','tool','category','palette','rotate',
  'duplicate','remove','inspect','undo','redo','save','load','new','export','import',
  'position','lifeState','objectCount','itemInfo','saveState','status'])
  assert(html.includes('id="'+id+'"'),'Missing control: '+id);
assert(html.includes('test-center.css')&&html.includes('test-center.js'));
assert(html.includes('class="architect-window uo-architect"'),
  'Old tall pane must be replaced with UO horizontal builder');
assert(html.includes('id="uoPaletteViewport"')&&html.includes('id="uoPrev"')&&
  html.includes('id="uoNext"'),'Tile browser needs left/right horizontal scrolling');
for(const id of ['uoSelect','uoPlace','uoMove','uoRotate','uoWallBrush','uoRoom',
  'uoFloor','uoUndo','uoRedo','uoBackup','uoRestore','uoSync',
  'uoClear','uoCommit','uoRevert','uoSettings','uoAdvanced','uoLevel'])
  assert(html.includes('id="'+id+'"'),'Missing UO tool control: '+id);
assert(html.includes('id="uoSync" type="button" disabled')&&
  html.includes('id="uoClear" type="button" disabled'),
  'Incomplete world-server operations cannot pretend to be active');
assert(html.includes('id="uoLevelUp" disabled')||html.includes('id="uoLevelUp" type="button" disabled'),
  'Unimplemented multiple building levels must remain disabled');
assert(css.includes('Medieval%20Architect%20UI%20Sprite%20Sheet.png'),
  'UO toolbar must use the approved owner-uploaded artwork, not plain dark UI');
assert(html.includes('id="uoFrameSkin"')&&js.includes('paintApprovedFrame'),
  'Horizontal stone border must be rendered from approved UI atlas');
assert(css.includes('.uo-architect .uo-command-frame{')&&
  css.includes('background:transparent')&&
  css.includes('grid-template-columns:repeat(6,minmax(0,94px))'),
  'Owner-approved compact command buttons must not use oversized gold surround');
assert(!html.includes('class="uo-dk-banner"'),
  'Do not crowd left tools with a partially hidden DK banner');
assert(js.includes('UI_ATLAS=')&&js.includes('data-uo-art')&&
  js.includes('uoHouseToolbar.v2'),'Approved sprite atlas and new layout preference key required');
assert(html.includes('dk-skills.js'),'Skill maintenance engine must load before the game');
assert(html.includes('assets/art/dkarchitect/imported/first-catalog.js')&&
  html.includes('assets/art/dkarchitect/imported/catalog.js')&&
  html.includes('dk-dungeon-art.js'),
  'Original 0x72, Dungeon II and both Pixel_Poem packs must load before Architect game script');
assert(js.includes("paletteViewport.addEventListener('wheel'"),
  'A mouse wheel must scroll the horizontal tile palette');

assert(!html.includes('project.godot')&&!html.includes('Capital & Consequence'));
const refreshRedirect=html.match(/<script id="refresh-to-menu">([\s\S]*?)<\/script>/)?.[1];
assert(refreshRedirect,'Temple must have an early refresh-only return-to-menu handler');
const refreshDestination=type=>{
  let destination=null;
  vm.runInNewContext(refreshRedirect,{window:{
    performance:{getEntriesByType:()=>[{type}]},
    location:{replace:path=>{destination=path;}}
  }});
  return destination;
};
assert.equal(refreshDestination('reload'),'./index.html','Refreshing temple returns to main menu');
assert.equal(refreshDestination('navigate'),null,'New Game / Continue may enter temple normally');
assert.equal(refreshDestination('back_forward'),null,'History navigation is not a page refresh');
assert(js.includes("const N = 16, TILE = 32"));
assert(js.includes("const AREA = 'dk.temple.sacrifice.001'"));
assert(js.includes("const STORE = 'dkSoftworks.demonkiller.testCenter.v1'"));
assert(!js.includes('dkSoftworks.testCenter.room.v1'),'Must not reuse C&C test save key');
assert(!js.includes('ccRoomLayoutV1'),'Must not access Capital & Consequence career keys');
assert(css.includes('image-rendering:pixelated'),'Pixel artwork should remain crisp');
const crystalFolder=path.join(root,'assets/art/crystals');
const variants=['gold','red','orange','yellow','green','cyan','blue','purple','pink'];
const crystalFiles=fs.readdirSync(crystalFolder).filter(f=>/^crystal_.*\.png$/.test(f));
assert.equal(crystalFiles.length,19,'Nine colored bright/dim crystals and one depleted silver');
for(const color of variants)for(const brightness of ['bright','dim']){
  const pathname=path.join(crystalFolder,'crystal_'+color+'_'+brightness+'.png');
  assert(fs.existsSync(pathname),'Missing approved crystal sprite: '+pathname);
}
assert(!fs.existsSync(path.join(crystalFolder,'crystal_silver_dim.png')),
  'Depleted silver crystal stays static and has no dim animation');
for(const file of crystalFiles){
  const buffer=fs.readFileSync(path.join(crystalFolder,file));
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a',
    'Crystal sprite must be a PNG: '+file);
  assert.equal(buffer.readUInt32BE(16),32,'Crystal sprite must use 32px tile width');
  assert.equal(buffer.readUInt32BE(20),32,'Crystal sprite must use 32px tile height');
}
const first=JSON.parse(read('assets/art/dkarchitect/imported/first-manifest.json'));
const combined=JSON.parse(read('assets/art/dkarchitect/imported/manifest.json'));
assert.equal(Object.keys(first.entries).length,243,'All 243 original 0x72 assets included');
assert(Object.keys(combined.entries).length>=380,'Dungeon II and both Pixel_Poem packs included');
for(const key of ['ox72i_wall_center','ox72i_wall_outer_nw','ox72i_wall_outer_se'])
  assert(first.entries[key],'Original 0x72 matching wall components must exist');
for(const key of ['ox72_wall_top_left','ox72_wall_top_right','ox72_wall_mid'])
  assert(combined.entries[key],'Dungeon II corner and straight wall components must exist');
assert(combined.entries['pixelpoem_enemies-vampire_attack'].frames.length>=10,
  'Pixel_Poem enemy animation contains its original multi-frame sequence');
for(const atlas of ['ox72-first-game-atlas.png','dk-imported-game-atlas.png']){
  const png=fs.readFileSync(path.join(root,'assets/art/dkarchitect/imported',atlas));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Approved atlas PNG signature');
}
assert(!fs.existsSync(path.join(root,'assets/art/dkarchitect/walls')),
  'All rejected owner-created wall sheets must be removed from active assets');
assert(!fs.existsSync(path.join(root,'assets/art/temple/walls/Dungeon Temple Wall Tile Atlas(1).png')),
  'Historical non-joinable master must not remain on live main');
assert(!fs.existsSync(path.join(root,'.github/workflows/import-ox72-first-dungeon-once.yml')),
  'One-time original 0x72 importer must remove its temporary workflow');
assert(html.includes('dk-dungeon-art.js')&&
  html.includes('assets/art/dkarchitect/imported/first-catalog.js')&&
  html.includes('assets/art/dkarchitect/imported/catalog.js'),
  'All four creator packs must load before Architect gameplay');
const dungeonRuntime=read('dk-dungeon-art.js');
assert(dungeonRuntime.includes('drawAutoFirst')&&dungeonRuntime.includes('drawAutoSecond'),
  'Both creator-defined auto-wall construction methods must exist');
assert(html.includes('id="wallBrush"')&&html.includes('id="wallLineButton"')&&
  html.includes('id="wallOutlineButton"')&&html.includes('id="assetSearch"'),
  'Pandora-style construction controls must be in the Architect panel');
assert(js.includes('wallPacks')&&js.includes('floorArt'),
  'Room save state supports distinct compatible wall sets and imported floors');
assert.match(js,/crystalSize=24/,'Crystals render smaller than the 32px player');
assert.match(js,/crystal_gold_.*crystalBright/,'Active crystals alternate only approved gold frames');
assert.match(js,/crystal_silver_depleted\.png/,'Spent crystal must use static silver asset');
assert.match(js,/beginResurrection\(obj\);draw\(\);return;/,'Double-click must consume the interacted crystal');
// One 3 × 2 altar footprint is shared between the starter room and DK Architect.
assert.match(js,/altar:\s*\{[^}]*w:\s*3,\s*h:\s*2/,'Architect altar must be three by two tiles');
assert.match(js,/\{ id:'sacrifice_altar', type:'altar', x:7, y:5, r:0 \}/,'Starter altar stays centered on north aisle');
assert.match(js,/const bodyWidth=40,bodyHeight=20/,'Lying body must match NPC scale');
assert.match(js,/ctx\.drawImage\(picture,x,y,bodyWidth,bodyHeight\)/,'Lying body must use its reduced dimensions');
const events={}, noop=()=>{};
const previewOutlines=[],spokenLines=[],filledPaths=[];
let activePath=[];
let lastPlayerTranslation={x:null,y:null};
const graphics={fillRect:noop,strokeRect:(...args)=>previewOutlines.push(args),fillText:(text,x,y)=>spokenLines.push({text,x,y}),clearRect:noop,
  beginPath:()=>{activePath=[];},moveTo:(x,y)=>activePath.push({x,y}),lineTo:(x,y)=>activePath.push({x,y}),
  closePath:noop,fill:()=>filledPaths.push(activePath.slice()),stroke:noop,save:noop,restore:noop,
  translate:(x,y)=>{lastPlayerTranslation={x,y};},rotate:noop,scale:noop};
class Element {
  constructor(id){this.id=id;this.textContent='';this.value='';this.files=[];this.children=[];
    this.style={};this.selectedOptions=[{textContent:id}];
    this.classList={toggle:noop};this.events={};}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  async emit(name,e={}){for(const fn of this.events[name]??[])await fn(e);}
  setAttribute(){}
  replaceChildren(...nodes){this.children=[...nodes];}
  append(...nodes){this.children.push(...nodes);}
  remove(){}
  click(){}
  getContext(){return graphics;}
  getBoundingClientRect(){return {left:0,top:0,width:512,height:512};}
  focus(){}
}
const elements={};const get=id=>elements[id]??(elements[id]=new Element(id));
const document={getElementById:get,createElement:name=>new Element(name),
  addEventListener:(name,fn)=>{(events[name]??=[]).push(fn);},body:new Element('body')};
const saved=new Map();
const localStorage={setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k)||null};
const frameQueue=[];
const requestAnimationFrame=fn=>frameQueue.push(fn);
let frameNumber=0;
const tickFrames=count=>{for(let i=0;i<count;i++){
  const cb=frameQueue.shift();assert(cb,'Missing animation callback');
  cb(++frameNumber*16);
}};
const sandbox={document,localStorage,Blob,URL,setTimeout,Date,console,requestAnimationFrame,
  window:{addEventListener:noop,location:{href:''}}};
vm.runInNewContext(read('assets/art/dkarchitect/imported/first-catalog.js'),sandbox,{filename:'first-catalog.js',timeout:3000});
vm.runInNewContext(read('assets/art/dkarchitect/imported/catalog.js'),sandbox,{filename:'catalog.js',timeout:3000});
vm.runInNewContext(dungeonRuntime,sandbox,{filename:'dk-dungeon-art.js',timeout:3000});
vm.runInNewContext(js,sandbox,{filename:'test-center.js',timeout:3000});
const key=code=>{for(const fn of events.keydown??[])fn({key:code,
  ctrlKey:false,metaKey:false,target:{tagName:'BODY'},preventDefault:noop});};
const click=async(x,y)=>get('room').emit('click',{button:0,clientX:x*32+16,clientY:y*32+16});
const dblclick=async(x,y)=>get('room').emit('dblclick',{button:0,clientX:x*32+16,clientY:y*32+16});
(async()=>{

  assert.equal(get('position').textContent,'(8, 12)');
  assert.match(get('lifeState').textContent,/ALIVE/);
  assert.equal(get('objectCount').textContent,'9','Crystal must be absent before Lilith places it');
  await click(8,7);
  assert.match(get('status').textContent,/Wait for the current scene/,'Interactions locked during sacrifice');
  tickFrames(175);
  assert(spokenLines.length>0,'Cult leader dialogue should render during the opening prayer');
  assert(filledPaths.some(points=>points.length===3 &&
    points[0].y===points[1].y &&
    points[2].y-points[0].y>=24 &&
    points[0].x<points[2].x && points[2].x<points[1].x),
    'All ritual dialogue tails use a long, pointed triangle rather than a square stub');
  assert(Math.max(...spokenLines.map(line=>line.y))<=160,
    'Speech must render above the bound player on the altar, not across the body');
  tickFrames(1625);
  assert.equal(get('position').textContent,'(8, 12)','Ghost emerges farther back on the central aisle');
  assert.match(get('lifeState').textContent,/GHOST/);
  assert.equal(get('objectCount').textContent,'10','Lilith leaves her crystal after prayer');
  await click(9,12);
  assert.equal(get('position').textContent,'(8, 12)','Left-clicking floor must not move');
  key('w');key('w');
  assert.equal(get('position').textContent,'(8, 10)');
  await dblclick(8,7);
  assert.match(get('status').textContent,/Move closer/,'Crystal requires reach');
  key('w');key('w');
  assert.equal(get('position').textContent,'(8, 8)');
  await click(8,7);
  assert.match(get('status').textContent,/A glowing gold crystal/,'Single-click only describes');
  assert.match(get('lifeState').textContent,/GHOST/);
  await click(8,7);await click(8,7);
  assert.match(get('lifeState').textContent,/GHOST/,'Several single clicks never resurrect');
  await dblclick(8,7);
  assert.match(get('status').textContent,/The crystal answers/,'Double-click begins resurrection');
  assert.match(js,/crystal\.spent=true;dirty=true;/,
    'The targeted crystal becomes silver immediately when resurrection begins');
  assert.match(get('lifeState').textContent,/GHOST/,'Resurrection is not instantaneous');
  tickFrames(130);
  assert.match(get('lifeState').textContent,/RESURRECTED/);
  assert.equal(get('position').textContent,'(8, 7)','Revived character emerges beside altar');
  await get('save').emit('click');
  assert.equal(saved.size,1,'Exactly one isolated storage key');
  assert(saved.has('dkSoftworks.demonkiller.testCenter.v1'));
  await get('new').emit('click');
  assert.match(get('lifeState').textContent,/ALIVE/,'Reset begins with player bound on altar');
  await get('load').emit('click');
  assert.match(get('lifeState').textContent,/RESURRECTED/,'Reload preserves resurrection');

  // The secret route must remain possible: walk around the crystal, through
  // solid furniture as a ghost, and reach the future courtyard connector.
  await get('new').emit('click');
  tickFrames(1800);
  key('a');for(let i=0;i<11;i++)key('w');
  key('d');key('w');
  assert.equal(sandbox.window.location.href,'./outdoor.html',
    'Walking into the open north door loads the courtyard automatically');
  assert.match(get('lifeState').textContent,/GHOST/);


  await get('new').emit('click');
  tickFrames(1800);
  const room=get('room');
  await room.emit('mousedown',{button:2,clientX:8*32+16,clientY:5*32+16,preventDefault:noop});
  assert.equal(get('position').textContent,'(8, 12)','Right mouse waits for frame');
  tickFrames(2);
  await room.emit('mouseup',{button:2});tickFrames(12);
  assert.notEqual(get('position').textContent,'(8, 12)',
    'Short right-click must keep walking toward its selected destination');
  tickFrames(155);
  assert.equal(get('position').textContent,'(8, 5)',
    'Quick right-click arrives at the exact requested tile without holding mouse');
  const arrived=get('position').textContent;tickFrames(30);
  assert.equal(get('position').textContent,arrived,'One-click travel stops on its target');
  await get('new').emit('click');tickFrames(1800);
  await room.emit('mousedown',{button:2,clientX:8*32+16,clientY:5*32+16,preventDefault:noop});
  tickFrames(21);
  assert.notEqual(get('position').textContent,'(8, 12)','Held right mouse moves continuously');
  await room.emit('mouseup',{button:2});tickFrames(12);
  const stopped=get('position').textContent;
  tickFrames(10);
  assert.equal(get('position').textContent,stopped,'Releasing stops motion');
  await room.emit('mousedown',{button:2,clientX:10*32+16,clientY:5*32+16,preventDefault:noop});
  let previous=stopped;
  const parse=record=>record.match(/\((\d+), (\d+)\)/).slice(1).map(Number);
  for(let i=0;i<18;i++){
    tickFrames(1);
    const current=get('position').textContent;
    const [px,py]=parse(previous),[cx,cy]=parse(current);
    assert(Math.abs(cx-px)+Math.abs(cy-py)<=1,
      'Right mouse may move one cardinal tile per step, never diagonally');
    previous=current;
  }
  assert.notEqual(previous,stopped,'Right mouse follows cursor through cardinal steps');
  await room.emit('mouseup',{button:2});

  // Inside the current 32px tile, pointer motion cannot shift the character
  // by fractions of a tile; the gameplay grid has four cardinal directions.
  await get('new').emit('click');tickFrames(1800);
  await room.emit('mousedown',{button:2,clientX:8*32+26,clientY:12*32+20,preventDefault:noop});
  tickFrames(40);
  assert.equal(get('position').textContent,'(8, 12)',
    'Clicking within the current grid tile never moves the logical player');
  assert.equal(lastPlayerTranslation.x,8*32);
  assert.equal(lastPlayerTranslation.y,12*32);
  await room.emit('mouseup',{button:2});

  await get('editMode').emit('click');
  assert.equal(get('modeLabel').textContent,'ARCHITECT MODE');
  await get('uoRotate').emit('click');
  assert.equal(get('tool').value,'rotate','Click-to-rotate mode arms before clicking an object');
  await click(3,2);await get('save').emit('click');
  let targeted=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(targeted.objects.find(o=>o.id==='pillar_west').r,1,
    'Tool-first Rotate works with no previous object selection');
  key('Escape');
  assert.equal(get('tool').value,'select','Escape cancels the targeting tool');
  await click(3,2);await get('save').emit('click');
  targeted=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(targeted.objects.find(o=>o.id==='pillar_west').r,1,
    'Escape prevents a stale Rotate operation on the next click');
  await get('undo').emit('click'); // Leave canonical temple prop orientation unchanged.
  await get('uoPlace').emit('click'); // Explicit tool choice: Esc correctly left Select active.

  const initial=Number(get('objectCount').textContent);
  await get('room').emit('mousemove',{clientX:2*32+16,clientY:5*32+16});
  await get('room').emit('wheel',{deltaY:100,preventDefault:noop});
  assert.match(get('status').textContent,/facing east/,'Mouse wheel rotates unplaced sprite preview');
  await click(2,5);
  assert.equal(Number(get('objectCount').textContent),initial+1,'Place original sprite');
  await get('undo').emit('click');
  assert.equal(Number(get('objectCount').textContent),initial,'Undo sprite placement');
  await get('redo').emit('click');
  assert.equal(Number(get('objectCount').textContent),initial+1,'Redo sprite placement');
  // Verify the translucent Architect preview and placement share the resized footprint.
  await get('palette').children[0].emit('click'); // Sacrificial altar in Relics
  await room.emit('mousemove',{clientX:4*32+16,clientY:6*32+16});
  assert(previewOutlines.some(([x,y,w,h])=>x===4*32+1&&y===6*32+1&&w===3*32-2&&h===2*32-2),
    'Altar preview should cover three by two grid tiles');
  await room.emit('wheel',{deltaY:100,preventDefault:noop});
  assert(previewOutlines.some(([x,y,w,h])=>x===4*32+1&&y===6*32+1&&w===2*32-2&&h===3*32-2),
    'Rotated altar preview should cover two by three grid tiles');
  await room.emit('wheel',{deltaY:-100,preventDefault:noop});
  await click(4,6);
  assert.equal(Number(get('objectCount').textContent),initial+2,'Architect places the resized altar');
  await click(5,7);
  assert.equal(Number(get('objectCount').textContent),initial+2,'Overlapping altar placement should be rejected');
  await get('save').emit('click');
  const layout=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(layout.objects.find(o=>o.x===2&&o.y===5).r,1,'Placed sprite keeps wheel rotation');
  await get('inspect').emit('click');
  assert.match(get('status').textContent,/ACCESS CHECK/);

  // Pandora-inspired wall texture palette, one-step wall lines and saved styles.
  const wallCategory=get('category');wallCategory.value='walls';
  await wallCategory.emit('change',{target:wallCategory});
  assert(get('palette').children.length>165,
    'Matching 0x72 original and Dungeon II systems plus Pixel_Poem tiles are browseable');
  const strip=get('uoPaletteViewport');strip.scrollLeft=0;
  await strip.emit('wheel',{deltaY:120,deltaX:0,deltaMode:0,cancelable:true,preventDefault:noop});
  assert.equal(strip.scrollLeft,120,'Wheel over art browser moves the horizontal scroll position');
  await strip.emit('wheel',{deltaY:-40,deltaX:0,deltaMode:0,cancelable:true,preventDefault:noop});
  assert.equal(strip.scrollLeft,80,'Reverse wheel returns toward earlier sprites');
  await get('palette').children[0].emit('click'); // Auto wall: 0x72 original.
  await click(1,6);
  const wallTool=get('tool');wallTool.value='wallLine';
  await wallTool.emit('change',{target:wallTool});
  // The test's freshly placed altar occupies (4,6)-(6,7), so use open row 8.
  await click(1,8);await click(4,8);
  await get('save').emit('click');
  const wallLayout=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(wallLayout.walls[6*16+1],1,'Wall brush creates connected wall cells');
  assert.equal(wallLayout.wallPacks[6*16+1],'ox72i','Original wall set survives room Save');
  for(let x=1;x<=4;x++){
    assert.equal(wallLayout.walls[8*16+x],1,'Straight-run wall is complete');
    assert.equal(wallLayout.wallPacks[8*16+x],'ox72i','Straight-run retains the matching creator set');
  }
  // The second 0x72 pack is selectable without combining different wall sets.
  const firstManual=get('palette').children[2]; // first independent creator wall tile
  await get('palette').children[1].emit('click');
  await click(5,8);await get('save').emit('click');
  const secondRoom=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(secondRoom.wallPacks[8*16+5],'ox72',
    'Dungeon II wall cells retain their own pack identity');
  await firstManual.emit('click');
  await click(6,8);await get('save').emit('click');
  const manual=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert(manual.wallVariants[8*16+6]?.startsWith('ox72i_'),
    'Hand-picked original 0x72 tile retains its validated identifier');
  const invalidWall=structuredClone(manual);
  invalidWall.wallVariants[8*16+6]='secret-wall-without-approval';
  get('import').files=[{size:8000,text:async()=>JSON.stringify(invalidWall)}];
  await get('import').emit('change',{target:get('import')});
  assert.match(get('status').textContent,/Import rejected/,
    'Unknown wall IDs cannot be injected through save imports');
  wallTool.value='wallErase';await wallTool.emit('change',{target:wallTool});
  await click(1,8);await get('save').emit('click');
  const erasedLayout=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(erasedLayout.walls[8*16+1],0,'Dedicated wall eraser clears wall geometry');
  assert.equal(erasedLayout.wallStyles[8*16+1],'clean','Erased wall loses its former finish');
  await get('uoRotate').emit('click');
  await click(6,8);await get('save').emit('click');
  const turned=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(turned.wallRotations[8*16+6],1,
    'Tool-first rotation persists for a manual wall component');
  key('Escape');


  // Static scene staging must use only approved game-ready sprites.
  wallCategory.value='library';await wallCategory.emit('change',{target:wallCategory});
  assert.equal(get('palette').children.length,25,'19 crystal images and six staging characters');
  await get('palette').children[0].emit('click');
  assert.equal(get('tool').value,'place','Selecting a staged asset enables placement');
  const countBeforeSprite=Number(get('objectCount').textContent);
  await click(2,6);
  assert.equal(Number(get('objectCount').textContent),countBeforeSprite+1,'Staged sprite should place');
  await get('save').emit('click');
  const staged=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  const newSprite=staged.objects.find(o=>o.type==='scenery'&&o.x===2&&o.y===6);
  assert(newSprite&&newSprite.spriteId==='crystal_gold_bright',
    'Staged sprite must retain its approved asset ID in saved room');
  // Select does not move; Move is a separate two-click GM tool.
  await get('uoSelect').emit('click');
  await click(2,6);await click(3,6);await get('save').emit('click');
  let stationary=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert(stationary.objects.some(o=>o.type==='scenery'&&o.x===2&&o.y===6),
    'Select mode must not move a previously highlighted object');
  await get('uoMove').emit('click');
  await click(2,6);await click(3,6);await get('save').emit('click');
  stationary=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert(stationary.objects.some(o=>o.type==='scenery'&&o.x===3&&o.y===6),
    'Move mode targets the object first, then a destination');
  await click(3,6);await click(2,6);
  await get('uoCopy').emit('click');await click(2,6);
  assert.equal(get('tool').value,'paste','Copy mode targets an item before enabling paste');
  key('Escape');
  assert.equal(get('tool').value,'select','Escape disarms paste');
  // Object inspector: exact position/rotation/collision and copy/paste.
  const toolSelect=get('tool');toolSelect.value='select';
  await toolSelect.emit('change',{target:toolSelect});
  await click(2,6);
  assert.equal(get('inspectorFields').hidden,false,'Selected object exposes coordinate inspector');
  get('inspectorX').value='3';get('inspectorY').value='6';
  get('inspectorFacing').value='1';get('inspectorSolid').value='solid';
  await get('inspectorApply').emit('click');
  await get('save').emit('click');
  const editedScene=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  const editedSprite=editedScene.objects.find(o=>o.type==='scenery'&&o.x===3&&o.y===6);
  assert(editedSprite&&editedSprite.r===1&&editedSprite.solidOverride===true,
    'Inspector applies exact position, cardinal facing and scene collision');
  await get('inspectorCopy').emit('click');
  assert.equal(get('tool').value,'paste','Copy switches Architect to paste mode');
  await click(2,6);await get('save').emit('click');
  const copiedScene=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(copiedScene.objects.filter(o=>o.type==='scenery'&&
    o.spriteId==='crystal_gold_bright').length,2,'Paste duplicates selected approved asset');
    const invalidAsset=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  invalidAsset.objects.find(o=>o.type==='scenery').spriteId='not-in-art-library';
  get('import').files=[{size:8000,text:async()=>JSON.stringify(invalidAsset)}];
  await get('import').emit('change',{target:get('import')});
  assert.match(get('status').textContent,/Import rejected/,'Unknown staged artwork cannot load');

  const invalid=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  invalid.area_id='other.world';
  get('import').files=[{size:8000,text:async()=>JSON.stringify(invalid)}];
  await get('import').emit('change',{target:get('import')});
  assert.match(get('status').textContent,/Import rejected/,'Foreign-area import rejected');
  console.log('PASS: Demon Killer temple test-center: 16x16 grid, original art, ghost/return branches,');
  console.log('      north connector, coordinates, editor, undo/redo, isolated save and import guards.');
})().catch(err=>{console.error(err);process.exitCode=1;});
