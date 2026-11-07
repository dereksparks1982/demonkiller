'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),E=require('../server/entity-registry-m10.cjs');
const H=require('../server/housing-m17.cjs'),G=require('../server/gameplay.cjs');
const M=require('../server/mobile-assets-m12.cjs'),R=require('../server/regions.cjs');
const D=require('../server/region-policies-m16.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6),HOME='courtyard_house_se';
function fixture(){
 const w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const c=w.characters['1'];
 Object.assign(c,{form:'living',opening_state:'resurrected',
  area_id:R.COURT,x:53,y:47,gold:300});
 c.region_id=D.regionAt(w,c.area_id,c.x,c.y).id;
 c.inventory.herbs=5;E.reconcile(w);W.validateWorld(w);return w;
}
test('M17 registers ten existing real-sized exteriors, not 1-tile houses',()=>{
 const w=fixture(),homes=Object.values(w.living.housing.records);
 assert.equal(homes.length,10);
 assert.equal(homes.filter(h=>h.owner?.kind==='npc').length,8);
 assert.equal(homes.filter(h=>!h.owner).length,2);
 assert.equal(w.living.housing.records[HOME].w,12);
 assert.equal(w.living.housing.records[HOME].h,10);
 assert.equal(w.living.housing.records.village_house_1.w,16);
 assert.equal(w.living.housing.records.village_house_1.h,12);
 assert.equal(H.ensure(w),false);
 E.counts(w);W.validateWorld(w);
});
test('Deed purchase moves real money into the bank and creates one owner record',()=>{
 const w=fixture(),bank=w.living.businesses.village_bank.coins,price=w.living.housing.records[HOME].price;
 const out=G.apply(w,{action:'buy_house',house_id:HOME});
 assert.equal(price,180);
 assert.equal(out.character.gold,300-price);
 assert.equal(out.world.living.businesses.village_bank.coins,bank+price);
 assert.equal(out.world.living.housing.records[HOME].owner.kind,'player');
 assert.equal(out.world.living.housing.records[HOME].public,false);
 assert.equal(out.world.living.housing.records[HOME].locked,true);
 assert.equal(out.event.type,'housing.purchased');
 assert.equal(w.living.housing.records[HOME].owner,null,'Previous world remains immutable');
 W.validateWorld(out.world);
});
test('House storage preserves item serials, and an occupied chest blocks resale',()=>{
 const w=fixture(),bought=G.apply(w,{action:'buy_house',house_id:HOME});
 const item=Object.values(bought.world.entity_registry.items).find(i=>
   i.parent===E.PACK&&i.type==='herbs');
 const stored=G.apply(bought.world,{action:'move_item',serial:item.serial,
   quantity:5,destination:'home_storage_'+HOME});
 assert.equal(stored.item.serial,item.serial);
 assert.equal(stored.character.inventory.herbs,0);
 assert.equal(E.inspect(stored.world).items.find(i=>i.serial===item.serial).parent,
   'home_storage_'+HOME);
 assert.throws(()=>G.apply(stored.world,{action:'sell_house',house_id:HOME}),/Empty your/);
 const back=G.apply(stored.world,{action:'move_item',serial:item.serial,
   quantity:5,destination:E.PACK});
 assert.equal(back.item.serial,item.serial);
 assert.equal(back.character.inventory.herbs,5);
 E.counts(back.world);W.validateWorld(back.world);
});
test('House resale returns exactly half its deed price without creating money',()=>{
 const w=fixture(),original=w.living.businesses.village_bank.coins,price=w.living.housing.records[HOME].price;
 const bought=G.apply(w,{action:'buy_house',house_id:HOME});
 const sold=G.apply(bought.world,{action:'sell_house',house_id:HOME});
 assert.equal(sold.character.gold,300-price+Math.floor(price/2));
 assert.equal(sold.world.living.businesses.village_bank.coins,original+price-Math.floor(price/2));
 assert.equal(sold.world.living.housing.records[HOME].owner,null);
 W.validateWorld(sold.world);
});
test('Property ownership cannot be forged, purchased remotely or duplicated',()=>{
 const w=fixture();
 assert.throws(()=>G.apply(w,{action:'buy_house',house_id:HOME,gold:999}),/Invalid/);
 assert.throws(()=>G.apply(w,{action:'buy_house',house_id:'village_house_3'}),/lawful owner|doorway/);
 const away=structuredClone(w);away.characters['1'].x=20;away.characters['1'].y=20;
 away.characters['1'].region_id=D.regionAt(away,R.COURT,20,20).id;
 assert.throws(()=>G.apply(away,{action:'buy_house',house_id:HOME}),/Visit/);
 const ghost=structuredClone(w);ghost.characters['1'].form='ghost';ghost.characters['1'].opening_state='complete';
 assert.throws(()=>G.apply(ghost,{action:'buy_house',house_id:HOME}),/Ghosts/);
 const bought=G.apply(w,{action:'buy_house',house_id:HOME});
 assert.throws(()=>G.apply(bought.world,{action:'set_house_public',house_id:HOME,public:'yes'}),/boolean/);
 assert.throws(()=>G.apply(bought.world,{action:'buy_house',house_id:'courtyard_house_sw'}),/doorway|only one/);
});
test('Non-owners cannot transfer a registered owner\'s secure goods',()=>{
 const w=fixture(),bought=G.apply(w,{action:'buy_house',house_id:HOME});
 const item=Object.values(bought.world.entity_registry.items).find(i=>i.type==='herbs'&&i.parent===E.PACK);
 const stored=G.apply(bought.world,{action:'move_item',serial:item.serial,quantity:5,destination:'home_storage_'+HOME});
 const unauthorized=structuredClone(stored.world);
 unauthorized.living.housing.records[HOME].owner=null;
 assert.throws(()=>G.apply(unauthorized,{action:'move_item',serial:item.serial,quantity:5,destination:E.PACK}),/locked/);
});
test('NPC death creates an estate rather than deleting the property',()=>{
 const w=fixture(),npc=w.living.npcs.baker;
 assert.equal(w.living.housing.records.village_house_3.owner.id,'baker');
 npc.alive=false;const events=[];M.onDeath(w,npc,w.living.minute,events);
 assert.equal(w.living.housing.records.village_house_3.owner.kind,'estate');
 assert.equal(npc.home_id,'village_house_3');
 assert(events.some(e=>e.type==='housing.estate'));
 assert.throws(()=>G.apply(w,{action:'buy_house',house_id:'village_house_3'}),/lawful owner/);
 E.reconcile(w);E.counts(w);W.validateWorld(w);
});
test('Server housing reads and deed purchase persist across restart',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m17-house-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(fixture()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const listing=await fetch(base+'/api/v1/housing');
 assert.equal(listing.status,200);
 const homes=(await listing.json()).houses;
 assert(homes.some(h=>h.id===HOME&&h.width===12&&h.height===10));
 const bought=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'buy_house',house_id:HOME})});
 assert.equal(bought.status,200);
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.living.housing.records[HOME].owner.kind,'player');
 await app.close();
 const reopened=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 try{assert.equal(reopened.world.living.housing.records[HOME].owner.kind,'player');}
 finally{await reopened.close();}
});
