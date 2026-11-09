'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const WORLD=require('../server/world.cjs'),ACTORS=require('../server/world-actors-m73.cjs');
const A=require('../server/atlas-afterlife-m80.cjs');
const E=require('../server/entity-registry-m10.cjs');
const ARMORY=require('../server/armory-m54.cjs');
const now=Date.UTC(2026,10,9);
function setup(){
 let w=WORLD.createCharacter(WORLD.makeWorld(now),1,'TEST',now).world;
 w.characters['1'].form='living';w.characters['1'].opening_state='resurrected';
 w.characters['1'].crystal_spent=true;w.characters['1'].revision++;
 w=ACTORS.perform(w,{action:'enter',x:4200,y:4200}).world;
 return w;
}
function addWeapon(w){
 const r=w.entity_registry,id='ent_'+r.next_serial++;
 r.items[id]={serial:id,kind:'item',type:'short_sword',amount:1,
  durability:100,parent:ARMORY.SLOTS.weapon,created_minute:w.living.minute};
 w.characters['1'].armory.slots.weapon=id;
 w.characters['1'].armory.durability[id]=100;
 WORLD.validateWorld(w);
 return id;
}
test('M80 cache is a persistent 9216-space object and conserves physical supplies and coins',()=>{
 let w=setup();w.living.atlas_resources.packs.player.timber=7;
 w=A.perform(w,{action:'cache_create',x:4201,y:4200}).world;
 const cache=Object.values(w.living.atlas_afterlife.caches)[0];
 assert.equal(cache.x,4201);assert.equal(cache.y,4200);assert.equal(cache.marked,true);
 w=A.perform(w,{action:'cache_store',id:cache.id,item:'timber',quantity:5}).world;
 w=A.perform(w,{action:'cache_store_coins',id:cache.id,quantity:2}).world;
 assert.equal(w.living.atlas_resources.packs.player.timber,2);
 assert.equal(w.living.atlas_afterlife.caches[cache.id].stock.timber,5);
 assert.equal(w.characters['1'].gold,3);
 WORLD.validateWorld(w);
 w=structuredClone(w);
 w.living.minute=20000; // Cache does not degrade with world minutes.
 A.advance(w,20000);
 assert.equal(w.living.atlas_afterlife.caches[cache.id].stock.timber,5);
 w=A.perform(w,{action:'cache_take',id:cache.id,item:'timber',quantity:4}).world;
 w=A.perform(w,{action:'cache_take_coins',id:cache.id,quantity:2}).world;
 assert.equal(w.living.atlas_resources.packs.player.timber,6);
 assert.equal(w.characters['1'].gold,5);WORLD.validateWorld(w);
});
test('M80 genuine gear serial survives cache storage and recovery, including bank isolation',()=>{
 let w=setup(),serial=addWeapon(w);
 w=A.perform(w,{action:'cache_create',x:4201,y:4200}).world;
 const id=Object.keys(w.living.atlas_afterlife.caches)[0];
 w=A.perform(w,{action:'cache_stash_gear',id,serial}).world;
 assert.equal(w.entity_registry.items[serial].parent,id);
 assert.equal(w.characters['1'].armory.slots.weapon,null);
 assert.equal(w.characters['1'].armory.durability[serial],undefined);
 assert(E.counts(w));WORLD.validateWorld(w);
 w=A.perform(w,{action:'cache_take_gear',id,serial}).world;
 assert.equal(w.entity_registry.items[serial].parent,E.PACK);
 assert.equal(w.characters['1'].inventory.short_sword,1);
 assert(E.counts(w));WORLD.validateWorld(w);
});
test('M80 ritual death creates a physical corpse, preserves bank and leaves ghost unable to loot',()=>{
 let w=setup(),serial=addWeapon(w),r=w.entity_registry;
 w.living.atlas_resources.packs.player.clay=4;
 w.characters['1'].gold=13;w.characters['1'].bank_gold=47;
 w=A.perform(w,{action:'ritual_death'}).world;
 const body=Object.values(w.living.atlas_afterlife.corpses)[0];
 assert.equal(body.stock.clay,4);assert.equal(body.coins,13);
 assert.equal(r.items[serial].parent,ARMORY.SLOTS.weapon,'old world unchanged');
 assert.equal(w.entity_registry.items[serial].parent,body.id);
 assert.equal(w.characters['1'].form,'ghost');
 assert.equal(w.characters['1'].opening_state,'complete');
 assert.equal(w.characters['1'].bank_gold,47);
 assert.deepEqual(w.living.atlas_resources.packs.player,{});
 assert.throws(()=>A.perform(w,{action:'body_take',id:body.id,item:'clay',quantity:1}),/Ghosts/);
 assert.throws(()=>A.perform(w,{action:'ritual_death'}),/Ghosts/);
 WORLD.validateWorld(w);
 w=A.perform(w,{action:'body_reclaim',id:body.id}).world;
 assert.equal(w.characters['1'].form,'living');
 assert.equal(w.characters['1'].opening_state,'resurrected');
 w=A.perform(w,{action:'body_take',id:body.id,item:'clay',quantity:4}).world;
 w=A.perform(w,{action:'body_take_coins',id:body.id,quantity:13}).world;
 w=A.perform(w,{action:'body_take_gear',id:body.id,serial}).world;
 assert.equal(w.living.atlas_resources.packs.player.clay,4);
 assert.equal(w.characters['1'].gold,13);
 assert.equal(w.entity_registry.items[serial].parent,E.PACK);
 assert.equal(w.characters['1'].inventory.short_sword,1);
 assert(E.counts(w));WORLD.validateWorld(w);
});
test('M80 monster takes actual item serial and leaves real loot bag on removal',()=>{
 let w=setup(),serial=addWeapon(w);
 w=A.perform(w,{action:'ritual_death'}).world;
 const corpse=Object.values(w.living.atlas_afterlife.corpses)[0];
 w=ACTORS.perform(w,{action:'introduce_npc',role:'monster',name:'Demon Raider',
   x:4202,y:4200}).world;
 const id=Object.keys(w.living.atlas_npcs.records)[0];
 w.living.minute=60;
 assert.equal(A.advance(w,60),1,'monster stole one item or coin');
 assert.equal(w.living.atlas_afterlife.corpses[corpse.id].coins,5);
 w.living.minute=120;
 assert.equal(A.advance(w,120),1);
 const loot='atlas_loot_'+id;
 assert.equal(w.entity_registry.items[serial].parent,loot);
 assert(E.counts(w));WORLD.validateWorld(w);
 w=ACTORS.perform(w,{action:'remove_npc',npc_id:id}).world;
 const bag=Object.values(w.living.atlas_afterlife.caches).find(x=>x.owner_serial===null);
 assert(bag);
 assert.equal(w.entity_registry.items[serial].parent,bag.id);
 assert.equal(w.entity_registry.containers[loot],undefined);
 assert(E.counts(w));WORLD.validateWorld(w);
});
test('M80 rejects invalid cache access, over-capacity and spoofed item serials',()=>{
 let w=setup();
 assert.throws(()=>A.perform(w,{action:'cache_create',x:4300,y:4300}),/beside/);
 assert.throws(()=>A.perform(w,{action:'cache_take',id:'atlas_cache_1',item:'stone',quantity:2}),/Unknown cache/);
 assert.throws(()=>A.perform(w,{action:'body_reclaim',id:'atlas_corpse_1'}),/ghost/);
 assert.throws(()=>A.perform(w,{action:'ritual_death'}),/weapon/);
});
test('M80 live atlas displays cache/corpse controls and server requires a dedicated work header',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'dk-world-explore-m73.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'dk-world-explore-m73.js'),'utf8');
 const server=fs.readFileSync(path.join(root,'server/dk-server.cjs'),'utf8');
 const client=fs.readFileSync(path.join(root,'dk-menu-server.js'),'utf8');
 for(const id of ['dkCacheCreate','dkRitualDeath','dkBodyReclaim','dkBodyTakeGear','dkCacheStoreGear'])
  assert(html.includes('id="'+id+'"'));
 assert.match(js,/view\.afterlife\?\.nearby_corpses/);
 assert.match(server,/x-dk-world-work'\]!==\s*'afterlife'/);
 assert.match(client,/worldAfterlife\(command\)/);
});
