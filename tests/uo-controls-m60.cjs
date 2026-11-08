'use strict';
// M60: UO keyboard mapping, saved war stance and persistent creature intelligence.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const fsp=require('node:fs/promises');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const R=require('../server/regions.cjs'),Combat=require('../server/combat-m8.cjs');
const AI=require('../server/monster-ai-m60.cjs');
const Keys=require('../dk-uo-controls-m60.js');
const {createDKServer}=require('../server/dk-server.cjs');
const root=path.resolve(__dirname,'..'),epoch=Date.UTC(2026,10,8);
function character(){
 let w=W.makeWorld(epoch);
 w=W.createCharacter(w,1,'ELIAS',epoch).world;
 return w;
}
test('M60 Tab and Alt+C are the UO war toggle; other classic shortcuts route correctly',()=>{
 const pairs=[
  ['Tab','war'],['Alt+C','war'],['Alt+P','paper'],['Alt+I','pack'],
  ['Alt+D','pack'],['Alt+K','skills'],['Alt+J','journal'],['Alt+R','radar'],
  ['Alt+S','status'],['Alt+B','spells'],['Alt+O','options'],
  ['Alt+X','quit'],['Alt+Enter','fullscreen'],
  ['L','attackLast'],['T','targetNearest'],['?','help']
 ];
 for(const [ch,expected] of pairs){
  const alt=ch.startsWith('Alt+'),key=alt?ch.slice(4):ch;
  assert.equal(Keys.command({key,altKey:alt}),expected,ch);
 }
 assert.equal(Keys.command({key:'Tab',shiftKey:true}),null);
 assert.equal(Keys.command({key:'Tab',ctrlKey:true}),null);
 assert.equal(Keys.command({key:'r'}),null,'R remains available for Architect');
 assert.equal(Keys.command({key:'p'}),null,'Plain P remains on the existing paper-doll path');
});
test('M60 server owns saved War Mode and refuses forged fields or ritual bypass',()=>{
 const original=character();
 assert.equal(original.characters['1'].war_mode,false);
 assert.throws(()=>W.applyCharacterAction(original,1,{action:'toggle_war'}),/ritual/i);
 const opened=W.applyCharacterAction(original,1,{action:'finish_opening'}).world;
 assert.equal(opened.characters['1'].war_mode,false);
 const war=W.applyCharacterAction(opened,1,{action:'toggle_war'});
 assert.equal(war.character.war_mode,true);
 assert.equal(opened.characters['1'].war_mode,false,'No in-place mutation');
 assert.equal(W.validateWorld(war.world),war.world);
 assert.throws(()=>W.applyCharacterAction(war.world,1,
  {action:'toggle_war',war_mode:false}),/parameters/i);
 const peace=W.applyCharacterAction(war.world,1,{action:'toggle_war'}).world;
 assert.equal(peace.characters['1'].war_mode,false);
 assert.equal(W.validateWorld(peace),peace);
});
test('M60 old character and monster records migrate non-destructively',()=>{
 const w=character(),c=w.characters['1'];delete c.war_mode;
 assert.equal(W.validateWorld(w),w,'Legacy character can still load');
 assert.equal(G.ensureProgress(c),true);
 assert.equal(c.war_mode,false);
 Combat.spawn(w,R.COURT,0,[],1,'wolf');
 const monster=Object.values(w.living.combat.creatures)[0],x=monster.x,y=monster.y;
 delete monster.ai;
 assert.equal(Combat.ensure(w),true);
 assert.equal(monster.ai.home_x,x);assert.equal(monster.ai.home_y,y);
 assert.equal(Combat.ensure(w),false);
 assert.equal(W.validateWorld(w),w);
});
test('M60 monster remembers last known target, searches, then returns to patrol',()=>{
 const w=character(),p=w.characters['1'];
 p.form='living';p.opening_state='resurrected';p.area_id=R.COURT;
 p.x=20;p.y=22;
 const creature={id:'wolf_981',kind:'wolf',area_id:R.COURT,
  x:20,y:20,health:24,alive:true};
 w.living.combat.creatures[creature.id]=creature;
 const events=[];
 assert.equal(AI.decide(w,creature,5,events).mode,'pursue');
 assert.equal(creature.ai.last_seen_minute,5);
 p.area_id=R.VILLAGE;
 const memory=AI.decide(w,creature,10,events);
 assert.equal(memory.mode,'search');
 assert.deepEqual(memory.goal,{area_id:R.COURT,x:20,y:22});
 assert.equal(AI.decide(w,creature,20,events).mode,'search');
 assert.equal(AI.decide(w,creature,21,events).mode,'patrol');
 assert.equal(AI.valid(w),true);
 assert.equal(W.validateWorld(w),w);
});
test('M60 injured creatures retreat; solid walls block perception',()=>{
 const w=character(),p=w.characters['1'];
 p.form='living';p.opening_state='resurrected';p.area_id=R.COURT;
 p.x=20;p.y=22;
 const c={id:'wolf_982',kind:'wolf',area_id:R.COURT,x:20,y:20,health:24,alive:true};
 w.living.combat.creatures[c.id]=c;
 const a=w.areas[R.COURT],idx=21*a.width+20;
 const original=a.walls[idx];a.walls[idx]=1;
 assert.equal(AI.sight(a,c,p),false);
 a.walls[idx]=original;
 AI.ensure(c);c.health=5;
 assert.equal(AI.decide(w,c,5,[]).mode,'retreat');
 const move=AI.retreatStep(w,c,p);
 assert(move&&Math.abs(move.x-p.x)+Math.abs(move.y-p.y)>
  Math.abs(c.x-p.x)+Math.abs(c.y-p.y));
 assert.equal(AI.valid(w),true);
});
test('M60 control windows do not become gameplay buttons or interfere with Lilith',()=>{
 const temple=fs.readFileSync(path.join(root,'test-center.html'),'utf8');
 const outdoors=fs.readFileSync(path.join(root,'outdoor.html'),'utf8');
 const client=fs.readFileSync(path.join(root,'outdoor.js'),'utf8');
 assert.match(temple,/dk-uo-controls-m60.js/);
 assert.match(outdoors,/dk-uo-controls-m60.js/);
 assert.match(temple,/dk-uo-controls-m60.css/);
 assert.match(outdoors,/dk-uo-controls-m60.css/);
 assert(client.includes("if(!uoControls?.isWar())"));
 assert(client.includes("lilithPhase==='playing'"));
 assert(!outdoors.includes('id="warModeButton"'));
 assert(!temple.includes('id="warModeButton"'));
});
test('M60 server exposes read-only monster behavior and serves controls',async t=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'dk-m60-'));
 t.after(()=>fsp.rm(dir,{recursive:true,force:true}));
 let w=character();
 w=W.applyCharacterAction(w,1,{action:'finish_opening'}).world;
 await fsp.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>epoch});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const post=()=>fetch(base+'/api/v1/characters/1/actions',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle_war'})});
 const war=await post();
 assert.equal(war.status,200);
 assert.equal((await war.json()).character.war_mode,true);
 const read=await fetch(base+'/api/v1/monster-ai');
 assert.equal(read.status,200);
 assert(Array.isArray((await read.json()).creatures));
 assert.equal((await fetch(base+'/api/v1/monster-ai',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 for(const file of ['dk-uo-controls-m60.js','dk-uo-controls-m60.css']){
  const r=await fetch(base+'/'+file);assert.equal(r.status,200);
  assert((await r.text()).length>1000);
 }
 const disk=JSON.parse(await fsp.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.characters['1'].war_mode,true);
 await app.close();
});
