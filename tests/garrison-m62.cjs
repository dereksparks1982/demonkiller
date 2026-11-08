'use strict';
// DK Server M62: saved paid garrison care, no infinite health/materials.
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs');
const R=require('../server/regions.cjs');
const G=require('../server/garrison-m62.cjs');
const V=require('../server/vendors-m18.cjs');
const E=require('../server/entity-registry-m10.cjs');
const DISTRICTS=require('../server/region-policies-m16.cjs');
const origin=Date.UTC(2026,10,8),world=()=>W.makeWorld(origin);
function patient(w,id='guard_north',shopId='village_tavern'){
 const n=w.living.npcs[id],shop=w.living.businesses[shopId],at=V.location(w,shop);
 n.area_id=shop.area_id;n.x=at.x;n.y=at.y;n.health=50;n.coins=25;
 shop.open=true;
 DISTRICTS.syncNpcTransitions(w,w.living.minute,[]);
 return {n,shop,at};
}
test('M62 seeded garrison records migrate older saves without removing guards or coins',()=>{
 const w=world(),bank=w.living.businesses.village_bank.coins;
 assert(G.ensure(w)===false);
 delete w.living.garrison;
 assert.equal(W.validateWorld(w),w);
 assert(G.ensure(w));assert(!G.ensure(w));
 assert(w.living.garrison.patients.guard_north);
 assert.equal(w.living.businesses.village_bank.coins,bank);
 assert.equal(W.validateWorld(w),w);
});
test('M62 a paid meal consumes one real vendor serial and heals an injured guard',()=>{
 const w=world(),{n,shop}=patient(w);
 w.living.minute=30;
 const before=shop.stock,coins=n.coins,treasury=shop.coins;
 const events=[];
 assert.equal(G.tick(w,30,events),1);
 assert.equal(n.health,62);assert.equal(n.coins,coins-4);
 assert.equal(shop.stock,before-1);assert.equal(shop.coins,treasury+4);
 assert(events.some(e=>e.type==='garrison.treated'&&
   e.item_type==='meals'&&e.item_serials?.length));
 assert.equal(G.validate(w),true);
 assert.equal(E.counts(w),true);
 assert.equal(W.validateWorld(w),w);
});
test('M62 bandages are a stronger remedy but still consume physical player-sold stock',()=>{
 const w=world(),{n,shop}=patient(w,'guard_north','village_market');
 shop.other_stock.bandages=1;
 w.living.minute=30;
 const gold=n.coins;const events=[];
 assert.equal(G.tick(w,30,events),1);
 assert.equal(n.health,80);assert.equal(n.coins,gold-6);
 assert.equal(shop.other_stock.bandages,0);
 assert.equal(w.living.garrison.total_paid,6);
 assert.equal(w.living.garrison.total_healed,30);
 assert.equal(E.counts(w),true);
 assert.equal(W.validateWorld(w),w);
});
test('M62 care obeys shops, sieges and real guard purchasing power',()=>{
 const w=world(),{n,shop}=patient(w);
 const originalStock=shop.stock,originalHealth=n.health;
 const events=[];w.living.minute=30;
 shop.open=false;assert.equal(G.tick(w,30,events),0);
 assert.equal(n.health,originalHealth);
 shop.open=true;w.living.territories[R.VILLAGE].control='monsters';
 w.living.minute=60;assert.equal(G.tick(w,60,events),0);
 w.living.territories[R.VILLAGE].control='settlers';
 n.coins=0;w.living.minute=90;assert.equal(G.tick(w,90,events),0);
 assert.equal(shop.stock,originalStock);assert.equal(n.health,originalHealth);
 assert.equal(w.living.garrison.total_treatments,0);
 assert.equal(E.counts(w),true);
});
test('M62 a wounded guard walks toward viable treatment instead of receiving remote care',()=>{
 const w=world(),n=w.living.npcs.guard_north;
 n.health=30;n.coins=20;
 const shop=w.living.businesses.village_tavern;shop.open=true;
 const pos=V.location(w,shop);
 const goal=G.destination(w,n);
 assert.deepEqual(goal,{area_id:shop.area_id,x:pos.x,y:pos.y});
 w.living.minute=30;
 assert.equal(G.tick(w,30,[]),0,'Must physically reach the storefront');
 assert.equal(n.health,30);
});
test('M62 care has an exact-once world interval and persists its ledger',()=>{
 const w=world(),{n}=patient(w);
 let history=[];w.living.minute=30;
 assert.equal(G.tick(w,30,history),1);
 const hp=n.health,coins=n.coins;
 assert.equal(G.tick(w,30,history),0);
 assert.equal(n.health,hp);assert.equal(n.coins,coins);
 w.living.minute=60;
 assert.equal(G.tick(w,60,history),1);
 assert.equal(w.living.garrison.total_treatments,2);
 const copy=JSON.parse(JSON.stringify(w));
 assert.equal(G.ensure(copy),false);
 assert.equal(W.validateWorld(copy),copy);
 assert.equal(copy.living.garrison.total_paid,8);
});
test('M62 new hired guards receive records; corrupted ledgers refuse loading',()=>{
 const w=world();
 const old=w.living.npcs.guard_south;
 w.living.npcs.resident_57={...old,id:'resident_57',name:'New Watchman',
  x:old.x,y:old.y,alive:true};
 assert.equal(G.ensure(w),true);
 assert.equal(G.ensure(w),false);
 assert(w.living.garrison.patients.resident_57);
 assert.equal(G.validate(w),true);
 w.living.garrison.patients.resident_57.healed=-10;
 assert.throws(()=>G.validate(w),/Invalid garrison patient/i);
});
test('M62 garrison route and simulation are server-owned; no extra on-screen toolbar',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const s=fs.readFileSync(path.join(__dirname,'../server/dk-server.cjs'),'utf8');
 const l=fs.readFileSync(path.join(__dirname,'../server/living-world.cjs'),'utf8');
 assert.match(s,/\/api\/v1\/garrison/);
 assert.match(l,/GARRISON[.]tick\(world,m,generated\)/);
 assert.match(l,/GARRISON[.]destination\(world,n\)/);
 assert(!fs.readFileSync(path.join(__dirname,'../outdoor.html'),'utf8')
   .includes('id="garrisonButton"'));
});
