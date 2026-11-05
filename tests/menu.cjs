'use strict';
// Demon Killer menu: standalone Node regression test. No npm install.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/);
assert(code,'Menu script not found');
assert(!html.includes('http-equiv="refresh"'));
assert(html.includes('assets/art/menu/demon-killer-main-menu-spritesheet.png'));
assert(fs.existsSync(path.join(root,'assets/art/menu/demon-killer-main-menu-spritesheet.png')));
const noop=()=>{},saved=new Map(),elements={};
class El{
 constructor(id){this.id=id;this.hidden=false;this.checked=true;this.disabled=false;
   this.value='';this.textContent='';this.events={};this.children=[];
   this.classList={add:noop};}
 addEventListener(n,cb){(this.events[n]??=[]).push(cb);}
 emit(n,e={}){for(const cb of this.events[n]||[])cb(e);}
 append(...list){this.children.push(...list);}
 replaceChildren(...list){this.children=list;}
 getContext(){return{clearRect:noop,drawImage:noop};}
 focus(){}matches(){return false;}
}
const get=id=>elements[id]??(elements[id]=new El(id));
const actions=Object.fromEntries(['new','continue','options','quit'].map(x=>[x,new El(x)]));
const backs=[new El('back0'),new El('back1'),new El('back2')];
const document={
 getElementById:get,createElement:n=>new El(n),
 querySelector:sel=>actions[sel.match(/data-action=(\w+)/)?.[1]]||null,
 querySelectorAll:sel=>sel==='.back'?backs:sel==='.art-button'?Object.values(actions):[],
 body:{classList:{add:noop}}
};
const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))};
const location={href:''};
const window={confirm:()=>true};
class Image{set src(v){this.file=v;}}
vm.runInNewContext(code[1],{document,localStorage,location,window,Image,Date,console},
 {filename:'index.html',timeout:3000});
actions.new.emit('click');
assert.equal(get('slotsScreen').hidden,false);
assert.equal(get('slots').children.length,3,'Three name records');
get('slots').children[0].emit('click');
assert.equal(get('nameScreen').hidden,false);
get('characterName').value='derek';
get('nameForm').emit('submit',{preventDefault:noop});
const record=JSON.parse(saved.get('dkSoftworks.demonkiller.characters.v1'));
assert.equal(record.slots[0].name,'DEREK');
assert.equal(saved.get('dkSoftworks.demonkiller.activeCharacter.v1'),'1');
assert.equal(location.href,'./test-center.html');
actions.continue.emit('click');
assert.equal(get('slots').children[1].disabled,true);
get('slots').children[0].emit('click');
assert.equal(location.href,'./test-center.html');
window.confirm=()=>false;
actions.new.emit('click');
get('slots').children[0].emit('click');
assert.equal(get('slotsScreen').hidden,false,'Canceled overwrite is non-destructive');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.characters.v1')).slots[0].name,'DEREK');
actions.options.emit('click');assert.equal(get('optionsScreen').hidden,false);
get('musicEnabled').checked=false;get('musicEnabled').emit('change');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).musicEnabled,false);
console.log('PASS: Demon Killer menu, approved art, named records, Continue, overwrite guard, options.');
