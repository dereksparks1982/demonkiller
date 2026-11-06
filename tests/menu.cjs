'use strict';
// Demon Killer menu: standalone Node regression test. No npm install.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/);
assert(code,'Menu script not found');
assert(!html.includes('http-equiv="refresh"'));
assert(!html.includes('id="castle"')&&!html.includes("artCanvas($('castle')")&&!html.includes('.castle{'),
 'The discarded haunted-house decoration must not appear in the main menu');
assert(html.includes('DK SOFTWORKS · HOUSE OF CULTURE'),'Correct studio branding must be visible');
assert(html.includes('assets/art/menu/demon-killer-main-menu-spritesheet.png'));
assert(html.includes('class="art-loading"')&&html.includes('.art-loading #home{visibility:hidden}'),
 'An unfinished text menu must not flash while the sprite sheet loads');
assert(html.includes("classList.remove('art-loading')"),
 'Artwork loading gate must open on success or failure');
assert(html.includes('min(265px,75vw,41svh)')&&html.includes('min(252px,78vw,38svh)'),
 'Approved menu art must scale with viewport height at 100% zoom');
assert(fs.existsSync(path.join(root,'assets/art/menu/demon-killer-main-menu-spritesheet.png')));
assert(html.includes('id="menuMusic"')&&html.includes('assets/audio/music/creepyloop-v2.ogg'),
 'Main menu must load the local OGG track');
const audioPath=path.join(root,'assets/audio/music/creepyloop-v2.ogg');
assert(fs.existsSync(audioPath),'Selected audio must be present in the game');
assert.equal(fs.readFileSync(audioPath).subarray(0,4).toString(),'OggS','Audio must be OGG');
const noop=()=>{},saved=new Map(),elements={};
class El{
 constructor(id){this.id=id;this.hidden=false;this.checked=true;this.disabled=false;
   this.value='';this.textContent='';this.events={};this.children=[];
   this.paused=true;this.playCount=0;this.pauseCount=0;
   this.classList={add:noop};this.attributes={};}
 addEventListener(n,cb){(this.events[n]??=[]).push(cb);}
 setAttribute(k,v){this.attributes[k]=v;}
 emit(n,e={}){for(const cb of this.events[n]||[])cb(e);}
 append(...list){this.children.push(...list);}
 replaceChildren(...list){this.children=list;}
 getContext(){return{clearRect:noop,drawImage:noop};}
 focus(){}matches(){return false;}
 play(){this.paused=false;this.playCount++;return Promise.resolve();}
 pause(){this.paused=true;this.pauseCount++;}
}
const get=id=>elements[id]??(elements[id]=new El(id));
const actions=Object.fromEntries(['new','continue','options','quit'].map(x=>[x,new El(x)]));
const backs=[new El('back0'),new El('back1'),new El('back2')];
const documentEvents={};
const document={
 getElementById:get,createElement:n=>new El(n),
 addEventListener:(name,fn)=>{(documentEvents[name]??=[]).push(fn);},
 querySelector:sel=>actions[sel.match(/data-action=(\w+)/)?.[1]]||null,
 querySelectorAll:sel=>sel==='.back'?backs:sel==='.art-button'?Object.values(actions):[],
 body:{classList:{add:noop}}
};
const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))};
const location={href:''};
class AudioNode{
 constructor(){this.connections=[];this.gain={value:1};this.threshold={value:0};this.knee={value:0};
  this.ratio={value:1};this.attack={value:0};this.release={value:0};}
 connect(target){this.connections.push(target);return target;}
}
class AudioContext{
 constructor(){this.state='suspended';this.destination=new AudioNode();this.source=new AudioNode();
  this.outputGain=new AudioNode();this.limiter=new AudioNode();AudioContext.instances.push(this);}
 createMediaElementSource(el){this.media=el;return this.source;}
 createGain(){return this.outputGain;}
 createDynamicsCompressor(){return this.limiter;}
 resume(){this.state='running';return Promise.resolve();}
}
AudioContext.instances=[];
const window={confirm:()=>true,AudioContext};
class Image{set src(v){this.file=v;}}
vm.runInNewContext(code[1],{document,localStorage,location,window,Image,Date,console},
 {filename:'index.html',timeout:3000});
assert.equal(get('menuMusic').volume,1);
assert.equal(get('musicVolume').value,'200');
assert.equal(get('musicVolumeValue').textContent,'200%');
assert.equal(AudioContext.instances.length,1);
const audio=AudioContext.instances[0];
assert.equal(audio.outputGain.gain.value,2,'200% must boost the actual audio signal');
assert.equal(audio.source.connections[0],audio.outputGain);
assert.equal(audio.outputGain.connections[0],audio.limiter,'Limiter must be in signal path');
assert.equal(audio.limiter.connections[0],audio.destination);
assert.equal(audio.limiter.threshold.value,-3);
assert.equal(audio.state,'running');
assert.equal(get('menuMusic').paused,false,'Menu should request music when enabled');
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
assert.equal(location.href,'./test-center.html?v='+version);
actions.continue.emit('click');
assert.equal(get('slots').children[1].disabled,true);
get('slots').children[0].emit('click');
assert.equal(location.href,'./test-center.html?v='+version);
window.confirm=()=>false;
actions.new.emit('click');
get('slots').children[0].emit('click');
assert.equal(get('slotsScreen').hidden,false,'Canceled overwrite is non-destructive');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.characters.v1')).slots[0].name,'DEREK');
actions.options.emit('click');assert.equal(get('optionsScreen').hidden,false);
assert(html.includes('Play main menu music')&&!html.includes('Play music when available'));
assert(html.includes('type="range" min="0" max="200"'));
get('musicVolume').value='75';get('musicVolume').emit('input');
assert.equal(audio.outputGain.gain.value,0.75,'Slider must control live signal');
assert.equal(get('musicVolumeValue').textContent,'75%');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).volumePercent,75);
get('musicVolume').value='200';get('musicVolume').emit('change');
assert.equal(audio.outputGain.gain.value,2);
get('musicEnabled').checked=false;get('musicEnabled').emit('change');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).musicEnabled,false);
assert.equal(get('menuMusic').paused,true,'Disabling music must pause audio');
assert.equal(get('musicVolume').disabled,true);
for(const fn of documentEvents.pointerdown||[])fn();
assert.equal(get('menuMusic').paused,true,'Disabled audio remains silent after interaction');
get('musicEnabled').checked=true;get('musicEnabled').emit('change');
assert.equal(get('menuMusic').paused,false,'Enabling music should resume audio');
assert.equal(get('musicVolume').disabled,false);
assert.equal(AudioContext.instances.length,1,'Music toggling must not duplicate audio nodes');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).musicEnabled,true);
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).volumePercent,200);
console.log('PASS: Demon Killer menu, amplified audio, saved slider, limiter, named records, Continue, overwrite guard, options.');
