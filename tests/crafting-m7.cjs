'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),Craft=require('../server/crafting-m7.cjs');
const G=require('../server/gameplay.cjs'),R=require('../server/regions.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const ORIGIN=Date.UTC(2026,10,6);
function fixture(){
 let w=W.makeWorld(ORIGIN);
 w=W.createCharacter(w,1,'ELIAS',ORIGIN).world;
 const c=w.characters['1'];
 c.area_id=R.COURT;c.x=30;c.y=30;c.form='living';c.opening_state='resurrected';
 c.inventory.wood=3;c.inventory.herbs=3;c.inventory.produce=3;
 c.inventory.bread=2;c.inventory.ore=3;
 return w;
}
test('M7 new characters and upgraded characters have stable survival and gear records',()=>{
 const w=fixture();assert.equal(w.characters['1'].crafting.hunger,80);
 assert.equal(Craft.ensure(w.characters['1']),false);
 assert.doesNotThrow(()=>W.validateWorld(w));
 delete w.characters['1'].crafting;
 assert.equal(Craft.ensure(w.characters['1']),true);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('recipes spend real ingredients and gain server-owned skill, with cooldown',()=>{
 let w=fixture();let result=G.apply(w,{action:'craft',recipe:'torch'});
 assert.equal(result.character.inventory.wood,2);
 assert.equal(result.character.inventory.herbs,2);
 assert.equal(result.character.inventory.torches,1);
 assert.equal(result.character.crafting.skill,2);
 assert.equal(w.characters['1'].inventory.torches,0,'Original world unchanged');
 assert.throws(()=>G.apply(result.world,{action:'craft',recipe:'rations'}),/wait/);
 result.world.living.minute=2;
 const made=G.apply(result.world,{action:'craft',recipe:'rations'});
 assert.equal(made.character.inventory.rations,2);
 assert.equal(made.character.inventory.bread,1);
 assert.doesNotThrow(()=>W.validateWorld(made.world));
});
test('smithy tools recipe checks the real building door and ingredient quantities',()=>{
 const w=fixture();
 assert.throws(()=>G.apply(w,{action:'craft',recipe:'tools'}),/smithy/);
 assert.throws(()=>G.apply(w,{action:'craft',recipe:'unknown'}),/Invalid recipe/);
});
test('equipment transfers items to slots, gives gathering benefit, and torches burn out',()=>{
 let w=fixture();
 w.characters['1'].inventory.tools=1;
 let r=G.apply(w,{action:'equip',item_type:'tools'});
 assert.equal(r.character.inventory.tools,0);
 assert.equal(r.character.crafting.hand,'tools');
 assert.throws(()=>G.apply(r.world,{action:'equip',item_type:'tools'}),/occupied/);
 r=G.apply(r.world,{action:'unequip',slot:'hand'});
 assert.equal(r.character.inventory.tools,1);
 const torch=G.apply(w,{action:'craft',recipe:'torch'});
 const lit=G.apply(torch.world,{action:'equip',item_type:'torches'});
 assert.equal(lit.character.crafting.light,'torches');
 const events=[];
 Craft.tick(lit.world,91,events);
 assert.equal(lit.world.characters['1'].crafting.light,null);
 assert.equal(events[0].type,'equipment.exhausted');
});
test('food, bandages, needs, and exhaustion recovery are durable',()=>{
 const w=fixture();let r=G.apply(w,{action:'consume',item_type:'bread'});
 assert.equal(r.character.crafting.hunger,95);
 assert.equal(r.character.inventory.bread,1);
 r.world.characters['1'].crafting.health=70;r.world.characters['1'].inventory.bandages=1;
 const heal=G.apply(r.world,{action:'consume',item_type:'bandages'});
 assert.equal(heal.character.crafting.health,90);
 const c=heal.world.characters['1'].crafting;
 c.hunger=0;c.health=1;c.energy=1;
 let events=[];
 Craft.tick(heal.world,30,events);
 assert.equal(c.incapacitated,true);
 assert.equal(c.health,0);
 assert.throws(()=>G.apply(heal.world,{action:'craft',recipe:'rations'}),/unconscious/);
 heal.world.living.minute=31;
 const rested=G.apply(heal.world,{action:'rest'});
 assert.equal(rested.character.crafting.incapacitated,false);
 assert(rested.character.crafting.health>=20);
});
test('server rejects forged materials and ghosts cannot craft',()=>{
 const w=fixture();
 assert.throws(()=>G.apply(w,{action:'craft',recipe:'torch',reward:999}),/Invalid/);
 w.characters['1'].inventory.wood=0;
 assert.throws(()=>G.apply(w,{action:'craft',recipe:'torch'}),/ingredients/);
 w.characters['1'].form='ghost';w.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(w,{action:'rest'}),/Ghosts/);
});
test('HTTP gameplay crafting writes inventory and skill to disk',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-crafting-m7-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(fixture()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>ORIGIN});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'craft',recipe:'torch'})});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.character.inventory.torches,1);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(saved.characters['1'].inventory.torches,1);
 await app.close();
});
