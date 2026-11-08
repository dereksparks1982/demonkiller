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
assert(html.includes('id="dkServerOptions"')&&html.includes('id="dkServerStart"')&&html.includes('id="dkServerStop"'),
 'Persistent world Start, Stop, and status must stay under Options');
assert(!html.includes('id="dkServerOptions" hidden'), 'Persistent World must be visible on the public webpage');
assert(html.includes('id="dkServerClock"'), 'World clock status must exist even while disconnected');
assert(/<script src="\.\/dk-menu-server\.js(?:\?v=[^\"]+)?"><\/script>/.test(html),
 'The main menu must load the local DK Server client');
assert(html.includes("await SERVER.startWorld();")&&html.includes("location.href='./test-center.html?dkSlot='+id+'&walk=continuous1';"),
 'The server-mode character launch must use a server record, not a browser save');

assert(html.includes('assets/art/menu/demon-killer-main-menu-spritesheet.png'));
assert(html.includes('class="art-loading"')&&html.includes('.art-loading #home{visibility:hidden}'),
 'An unfinished text menu must not flash while the sprite sheet loads');
assert(html.includes("classList.remove('art-loading')"),
 'Artwork loading gate must open on success or failure');
assert(html.includes('min(265px,75vw,41svh)')&&html.includes('min(252px,78vw,38svh)'),
 'Approved menu art must scale with viewport height at 100% zoom');
assert(fs.existsSync(path.join(root,'assets/art/menu/demon-killer-main-menu-spritesheet.png')));
assert(html.includes('dk-midi-soundtrack.js?v=m58')&&
 html.includes('assets/audio/music/demon-killer-title-theme-v1.mid'),
 'Main menu must play the original MIDI title theme');
assert(!html.includes('src="./assets/audio/music/creepyloop-v2.ogg"'),
 'The retired menu OGG must not be active');
assert(fs.existsSync(path.join(root,'assets/audio/music/demon-killer-title-theme-v1.mid')));
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
const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};
const location={href:''};
const midi={volume:0,playing:false,playCount:0,stopCount:0,
 setVolume(value){this.volume=value;},
 play(){this.playing=true;this.playCount++;return Promise.resolve(true);},
 stop(){this.playing=false;this.stopCount++;}
};
const window={confirm:()=>true,
 addEventListener:noop,
 DKMidiSoundtrack:{create({url}){assert.match(url,/demon-killer-title-theme-v1[.]mid/);return midi;}}
};
class Image{set src(v){this.file=v;}}
vm.runInNewContext(code[1],{document,localStorage,location,window,Image,Date,console},
 {filename:'index.html',timeout:3000});
assert.equal(get('musicVolume').value,'200');
assert.equal(get('musicVolumeValue').textContent,'200%');
assert.equal(midi.volume,200);
assert.equal(midi.playCount,1,'Menu must start original MIDI playback when enabled');
actions.new.emit('click');
assert.equal(get('slotsScreen').hidden,false);
assert.equal(get('slots').children.length,1,'Only one character slot is shown');
get('slots').children[0].emit('click');
assert.equal(get('nameScreen').hidden,false);
get('characterName').value='derek';
get('nameForm').emit('submit',{preventDefault:noop});
const record=JSON.parse(saved.get('dkSoftworks.demonkiller.characters.v1'));
assert.equal(record.slots[0].name,'DEREK');
assert.equal(saved.get('dkSoftworks.demonkiller.activeCharacter.v1'),'1');
assert.equal(location.href,'./test-center.html?v='+version+'-continuous1');
actions.continue.emit('click');
assert.equal(get('slots').children[0].disabled,false,'Existing character can Continue');
get('slots').children[0].emit('click');
assert.equal(location.href,'./test-center.html?v='+version+'-continuous1');
actions.new.emit('click');
assert.equal(get('slots').children[0].disabled,true,'The single occupied character slot cannot be replaced');
get('slots').children[0].emit('click');
assert.equal(get('slotsScreen').hidden,false,'Occupied life cannot be overwritten');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.characters.v1')).slots[0].name,'DEREK');
actions.options.emit('click');assert.equal(get('optionsScreen').hidden,false);
assert(html.includes('Play main menu music')&&!html.includes('Play music when available'));
assert(html.includes('type="range" min="0" max="200"'));
get('musicVolume').value='75';get('musicVolume').emit('input');
assert.equal(midi.volume,75,'Slider must control the original MIDI synthesizer');
assert.equal(get('musicVolumeValue').textContent,'75%');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).volumePercent,75);
get('musicVolume').value='200';get('musicVolume').emit('change');
assert.equal(midi.volume,200);
get('musicEnabled').checked=false;get('musicEnabled').emit('change');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).musicEnabled,false);
assert.equal(midi.playing,false,'Disabling music must stop MIDI notes');
assert.equal(get('musicVolume').disabled,true);
for(const fn of documentEvents.pointerdown||[])fn();
assert.equal(midi.playing,false,'Disabled audio remains silent after interaction');
get('musicEnabled').checked=true;get('musicEnabled').emit('change');
assert.equal(midi.playing,true,'Enabling music should resume MIDI');
assert.equal(get('musicVolume').disabled,false);
assert.equal(midi.playCount,2,'Enabling MIDI must restart just once');
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).musicEnabled,true);
assert.equal(JSON.parse(saved.get('dkSoftworks.demonkiller.menuPrefs.v1')).volumePercent,200);
console.log('PASS: Demon Killer menu, original MIDI, saved slider, music toggle, single life, Continue, occupied-slot guard, persistent-world options.');
