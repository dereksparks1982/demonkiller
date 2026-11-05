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
const events={}, noop=()=>{};
const graphics={fillRect:noop,strokeRect:noop,clearRect:noop,beginPath:noop,
  moveTo:noop,lineTo:noop,stroke:noop,save:noop,restore:noop,
  translate:noop,rotate:noop,scale:noop};
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
  window:{addEventListener:noop}};
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
  tickFrames(1800);
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
  assert.equal(get('position').textContent,'(8, 0)');
  assert.match(get('lifeState').textContent,/GHOST/);
  assert.match(get('status').textContent,/courtyard/i);


  await get('new').emit('click');
  tickFrames(1800);
  const room=get('room');
  await room.emit('mousedown',{button:2,clientX:8*32+16,clientY:5*32+16,preventDefault:noop});
  assert.equal(get('position').textContent,'(8, 12)','Right mouse waits for frame');
  tickFrames(2);
  await room.emit('mouseup',{button:2});tickFrames(12);
  assert.equal(get('position').textContent,'(8, 12)','Short right click stops immediately');
  await room.emit('mousedown',{button:2,clientX:8*32+16,clientY:5*32+16,preventDefault:noop});
  tickFrames(21);
  assert.notEqual(get('position').textContent,'(8, 12)','Held right mouse moves continuously');
  await room.emit('mouseup',{button:2});tickFrames(12);
  const stopped=get('position').textContent;
  tickFrames(10);
  assert.equal(get('position').textContent,stopped,'Releasing stops motion');
  await room.emit('mousedown',{button:2,clientX:10*32+16,clientY:5*32+16,preventDefault:noop});
  tickFrames(18);
  const moved=get('position').textContent;
  assert.notEqual(moved,stopped,'Diagonal right mouse follows cursor');
  await room.emit('mouseup',{button:2});

  await get('editMode').emit('click');
  assert.equal(get('modeLabel').textContent,'ARCHITECT MODE');
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
  await get('save').emit('click');
  const layout=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  assert.equal(layout.objects.find(o=>o.x===2&&o.y===5).r,1,'Placed sprite keeps wheel rotation');
  await get('inspect').emit('click');
  assert.match(get('status').textContent,/ACCESS CHECK/);

  const invalid=JSON.parse(saved.get('dkSoftworks.demonkiller.testCenter.v1'));
  invalid.area_id='other.world';
  get('import').files=[{size:8000,text:async()=>JSON.stringify(invalid)}];
  await get('import').emit('change',{target:get('import')});
  assert.match(get('status').textContent,/Import rejected/,'Foreign-area import rejected');
  console.log('PASS: Demon Killer temple test-center: 16x16 grid, original art, ghost/return branches,');
  console.log('      north connector, coordinates, editor, undo/redo, isolated save and import guards.');
})().catch(err=>{console.error(err);process.exitCode=1;});
