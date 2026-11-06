'use strict';
// Demon Killer intro/cutscene: standalone simulated-frame regression test.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','test-center.js'),'utf8');
const no=()=>{},events={},frames=[],stored=new Map(),elements={};
const spoken=[],context={fillText:value=>spoken.push(String(value)),fillRect:no,strokeRect:no,clearRect:no,beginPath:no,
 moveTo:no,lineTo:no,closePath:no,fill:no,stroke:no,save:no,restore:no,translate:no,rotate:no,scale:no,drawImage:no};
class El{
 constructor(id){this.id=id;this.textContent='';this.value='';this.children=[];this.style={};
  this.selectedOptions=[{textContent:id}];this.classList={toggle:no};this.events={};}
 addEventListener(n,fn){(this.events[n]??=[]).push(fn);}
 emit(n,e={}){for(const fn of this.events[n]||[])fn(e);}
 getContext(){return context;}
 getBoundingClientRect(){return{left:0,top:0,width:512,height:512};}
 setAttribute(){}replaceChildren(...v){this.children=v;}append(...v){this.children.push(...v);}
 focus(){}remove(){}click(){}
}
const get=id=>elements[id]??(elements[id]=new El(id));
const document={getElementById:get,createElement:n=>new El(n),
 addEventListener:(n,fn)=>(events[n]??=[]).push(fn),body:new El('body')};
const localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,String(v))};
const window={addEventListener:no};
const requestAnimationFrame=fn=>frames.push(fn);
vm.runInNewContext(code,{document,localStorage,window,requestAnimationFrame,
 Blob,URL,setTimeout,Date,console},{filename:'test-center.js',timeout:3000});
let time=0;
function tick(n){for(let i=0;i<n;i++){const fn=frames.shift();
 assert(fn,'Animation frame missing');time+=16;fn(time);}}
function key(k){for(const fn of events.keydown||[])fn({key:k,ctrlKey:false,metaKey:false,
 target:{tagName:'BODY'},preventDefault:no});}
assert.match(get('status').textContent,/Cult members surround/i);
key('w');assert.equal(get('position').textContent,'(8, 12)','Player locked during opening');
const room=get('room');
room.emit('click',{button:0,clientX:8*32+16,clientY:9*32+16});
assert.match(get('lifeState').textContent,/ALIVE/,'Player remains bound until sacrificed');
tick(145);
assert(spoken.join(' ').includes('The veil knows your name.'),'Leader cryptic speech balloon visible');
tick(150);
assert(spoken.join(' ').includes('Your life ends here.'),'Leader announces death in balloon');
tick(490);
assert(spoken.join(' ').includes("You're mine."),'Devil speaks his promised line');
tick(105);
assert(spoken.join(' ').includes('Death offers no escape.'),'Devil follows up in a second balloon');
tick(390);
assert(spoken.join(' ').includes('In ash and silence'),'Lilith prayer balloon visible');
tick(560);
assert.match(get('status').textContent,/Double-left-click the crystal/i);
assert.equal(get('position').textContent,'(8, 12)','Ghost emerges farther back along the central aisle');
assert.equal(Number(get('objectCount').textContent),10,'Crystal appears only after Lilith prays');
key('w');assert.equal(get('position').textContent,'(8, 11)','Ghost control unlocked afterward');
get('save').emit('click');
const saved=JSON.parse(stored.get('dkSoftworks.demonkiller.testCenter.v1'));
assert.equal(saved.introSeen,true,'Completed intro persists to save');
assert.equal(saved.objects.find(o=>o.id==='temple_north_door').open,true,
 'Lilith leaves the temple door open after cult closes it');
get('new').emit('click');
key('w');assert.equal(get('position').textContent,'(8, 12)','Reset replays locked opening');
get('editMode').emit('click');
assert.equal(get('modeLabel').textContent,'ARCHITECT MODE','Existing Architect still available');
console.log('PASS: cult sacrifice, Devil encounter, Lilith prayer, timed crystal, save and Architect.');
