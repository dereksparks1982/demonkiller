'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const W=require('../server/world.cjs'),L=require('../server/living-world.cjs');
const AI=require('../server/mobile-ai-m21.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const ORIGIN=Date.UTC(2026,10,6);
function world(){return W.makeWorld(ORIGIN);}
function monster(w,id,n,x=n.x+2,y=n.y){
 const imp={id,kind:'imp',area_id:n.area_id,x,y,health:18,alive:true,
   spawn_minute:0,last_attack_minute:-1};
 w.living.combat.creatures[id]=imp;return imp;
}
test('M21 seeds and validates one saved brain per NPC without old-save loss',()=>{
 const w=world(),old=w.living.npcs.baker.name;
 assert.equal(Object.keys(w.living.npc_ai.brains).length,Object.keys(w.living.npcs).length);
 assert.equal(AI.ensure(w),false);
 delete w.living.npc_ai;
 assert.equal(AI.ensure(w),true);
 assert.equal(w.living.npcs.baker.name,old);
 assert.equal(AI.ensure(w),false);
 W.validateWorld(w);
});
test('Unarmed civilians flee actual nearby monsters and find reachable cardinal ground',()=>{
 const w=world(),n=w.living.npcs.baker,m=monster(w,'imp_901',n);
 w.living.minute=5;const history=[];
 const b=AI.sense(w,n,5,history),spot=AI.destination(w,n);
 assert.equal(b.mode,'flee');
 assert.equal(b.threat_id,m.id);
 assert(spot,'Civilian found a safe reachable destination');
 assert.equal(spot.area_id,n.area_id);
 assert(Math.abs(spot.x-m.x)+Math.abs(spot.y-m.y)>
   Math.abs(n.x-m.x)+Math.abs(n.y-m.y));
 assert.equal(history[0].type,'npc.ai.flee');
 W.validateWorld(w);
});
test('Guards and escorts defend the nearby residents rather than flee',()=>{
 const w=world(),guard=w.living.npcs.guard_north,m=monster(w,'imp_902',guard);
 w.living.minute=5;const history=[];
 const brain=AI.sense(w,guard,5,history);
 assert.equal(brain.mode,'defend');
 assert.deepEqual(AI.destination(w,guard),{area_id:guard.area_id,x:m.x,y:m.y});
 assert.equal(history[0].type,'npc.ai.defend');
 W.validateWorld(w);
});
test('Fleeing ends when the threat disappears; routine resumes after a saved calm interval',()=>{
 const w=world(),n=w.living.npcs.baker,m=monster(w,'imp_903',n);
 w.living.minute=5;AI.sense(w,n,5,[]);
 m.alive=false;w.living.minute=10;AI.sense(w,n,10,[]);
 assert.equal(w.living.npc_ai.brains.baker.mode,'recover');
 assert.equal(AI.destination(w,n),null);
 w.living.minute=36;AI.sense(w,n,36,[]);
 assert.equal(w.living.npc_ai.brains.baker.mode,'work');
 assert.equal(w.living.npc_ai.brains.baker.calm_after_minute,35);
 W.validateWorld(w);
});
test('Defensive AI is server-time based and survives a serialized world save',()=>{
 const w=world(),n=w.living.npcs.guard_north;
 monster(w,'imp_904',n);
 w.living.minute=5;AI.sense(w,n,5,[]);
 const copy=JSON.parse(JSON.stringify(w));
 assert.equal(AI.ensure(copy),false);
 assert.equal(copy.living.npc_ai.brains.guard_north.mode,'defend');
 W.validateWorld(copy);
});
test('NPC behavior listing is restricted to the player current region and proximity',()=>{
 let w=W.createCharacter(world(),1,'DEREK',ORIGIN).world;
 w.characters['1'].area_id=w.living.npcs.baker.area_id;
 w.characters['1'].x=w.living.npcs.baker.x;
 w.characters['1'].y=w.living.npcs.baker.y;
 const view=AI.listing(w);
 assert(view.nearby.some(n=>n.npc_id==='baker'));
 assert(!view.nearby.some(n=>n.npc_id==='courtyard_keeper'));
 assert(view.nearby.every(n=>['work','recover','flee','defend','dead'].includes(n.mode)));
});
test('Invalid or corrupted NPC behavior records are rejected',()=>{
 const w=world();w.living.npc_ai.brains.baker.mode='teleport';
 assert.throws(()=>AI.validate(w),/Invalid NPC behavior state/);
});
test('HTTP shows physical nearby NPC modes, never allows direct brain edits',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-mobile-ai-m20-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const w=W.createCharacter(world(),1,'ELIAS',ORIGIN).world;
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(w));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>ORIGIN});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/npc-ai');
 assert.equal(response.status,200);
 const listing=await response.json();
 assert.equal(listing.minute,0);
 assert(Array.isArray(listing.nearby));
 assert.equal((await fetch(base+'/api/v1/npc-ai',{method:'POST',
   headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
});
