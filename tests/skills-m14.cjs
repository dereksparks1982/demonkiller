'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const S=require('../server/skills-m14.cjs');
const W=require('../server/world.cjs'),G=require('../server/gameplay.cjs');
const C=require('../server/crafting-m7.cjs');
const {createDKServer}=require('../server/dk-server.cjs');
const T=Date.UTC(2026,10,6);
function world(){
 let w=W.createCharacter(W.makeWorld(T),1,'ELIAS',T).world;
 const c=w.characters['1'];
 c.form='living';c.opening_state='resurrected';
 return w;
}
test('M14 uses fixed tenths, individual skill caps and an exact 700-point total limit',()=>{
 const w=world(),b=w.characters['1'].skillbook;
 assert.equal(b.schema,1);
 assert.equal(b.total_cap,7000);
 assert.equal(Object.keys(b.skills).length,10);
 assert.equal(S.total(w.characters['1']),0);
 assert.equal(S.ensure(w.characters['1']),false);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('Existing M13 experience migrates once with no character, wealth or skill loss',()=>{
 const w=world(),c=w.characters['1'];
 c.skills.foraging=18;c.skills.commerce=23;c.skills.combat=17;c.crafting.skill=33;
 const beforeGold=c.gold;
 delete c.skillbook;
 assert.equal(S.ensure(c),true);
 assert.equal(c.skillbook.skills.herbalism.value,18);
 assert.equal(c.skillbook.skills.trading.value,23);
 assert.equal(c.skillbook.skills.tactics.value,17);
 assert.equal(c.skillbook.skills.survival.value,33);
 assert.equal(S.ensure(c),false);
 assert.equal(c.gold,beforeGold);
 assert.doesNotThrow(()=>W.validateWorld(w));
});
test('Practice requires real world minute and target, suppresses identical macro grinding',()=>{
 const c=world().characters['1'];
 assert.equal(S.practice(c,'mining',0,'ore_1').gained,1);
 assert.equal(S.practice(c,'mining',1,'ore_1').gained,1);
 assert.equal(S.practice(c,'mining',2,'ore_1').gained,1);
 assert.equal(S.practice(c,'mining',3,'ore_1').gained,0);
 assert.equal(S.practice(c,'mining',20,'ore_1').gained,1);
 assert.equal(c.skillbook.skills.mining.value,4);
 assert.equal(c.skillbook.skills.mining.uses,5);
 assert.throws(()=>S.practice(c,'forged_skill',21,'ore_1'),/Invalid/);
});
test('Training locks stop gains; down-skills are sacrificed only at the total cap',()=>{
 const c=world().characters['1'];
 for(const name of S.SKILL_NAMES.slice(0,7))c.skillbook.skills[name].value=1000;
 c.skillbook.skills.lumberjacking.lock='down';
 assert.equal(S.total(c),7000);
 const gain=S.practice(c,'wrestling',10,'imp_1');
 assert.equal(gain.gained,1);
 assert.equal(c.skillbook.skills.wrestling.value,1);
 assert.equal(c.skillbook.skills.lumberjacking.value,999);
 assert.equal(S.total(c),7000);
 c.skillbook.skills.wrestling.lock='locked';
 assert.equal(S.practice(c,'wrestling',11,'imp_2').gained,0);
 c.skillbook.skills.wrestling.lock='up';
 c.skillbook.skills.lumberjacking.lock='locked';
 assert.equal(S.practice(c,'wrestling',20,'imp_3').gained,0);
 assert.equal(S.total(c),7000);
});
test('Slower gains at higher skill values and individual cap cannot overflow',()=>{
 const c=world().characters['1'],s=c.skillbook.skills.healing;
 s.value=600;
 assert.equal(S.practice(c,'healing',20,'bandage_a').gained,1);
 assert.equal(S.practice(c,'healing',21,'bandage_b').gained,0);
 assert.equal(S.practice(c,'healing',24,'bandage_c').gained,1);
 s.value=1000;
 assert.equal(S.practice(c,'healing',50,'bandage_d').gained,0);
 assert.throws(()=>{s.value=1001;S.validate(c);},/Invalid/);
});
test('Skill lock actions persist atomically and reject client-invented skill levels',()=>{
 const w=world();
 const r=G.apply(w,{action:'skill_lock',skill:'mining',lock:'locked'});
 assert.equal(r.character.skillbook.skills.mining.lock,'locked');
 assert.equal(w.characters['1'].skillbook.skills.mining.lock,'up');
 assert.equal(r.event.type,'skill.lock.changed');
 assert.throws(()=>G.apply(w,{action:'skill_lock',skill:'mining',lock:'up',value:999}),
  /Invalid/);
 assert.throws(()=>G.apply(w,{action:'skill_lock',skill:'magery',lock:'up'}),/Invalid/);
 assert.throws(()=>G.apply(r.world,{action:'skill_lock',skill:'mining',lock:'locked'}),/already/);
 assert.doesNotThrow(()=>W.validateWorld(r.world));
});
test('Real crafting, gathering and trade actions train their corresponding professions',()=>{
 let w=world(),c=w.characters['1'];
 c.inventory.wood=2;c.inventory.herbs=3;c.inventory.bread=1;c.inventory.produce=1;
 const node=Object.values(w.living.resources).find(n=>n.id==='courtyard_wood');
 assert(node);
 // Test actual harvesting at the resource, not an unrelated hardcoded tile.
 c.area_id=node.area_id;c.x=node.x;c.y=node.y;
 c.region_id=require('../server/region-policies-m16.cjs').regionAt(w,c.area_id,c.x,c.y).id;
 let g=G.apply(w,{action:'gather',node_id:node.id});
 assert.equal(g.character.skillbook.skills.lumberjacking.value,1);
 w=g.world;w.living.minute=1;
 const craft=G.apply(w,{action:'craft',recipe:'torch'});
 assert.equal(craft.character.skillbook.skills.survival.value,1);
 assert.equal(craft.character.inventory.torches,1);
 w=craft.world;w.living.minute=2;
 const ration=G.apply(w,{action:'craft',recipe:'rations'});
 assert.equal(ration.character.skillbook.skills.cooking.value,1);
 assert.doesNotThrow(()=>W.validateWorld(ration.world));
});
test('Read-only HTTP skillbook and authenticated-in-process training lock persist to disk',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m14-skills-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'world.json'),JSON.stringify(world()));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>T});
 t.after(()=>app.server.listening?app.close():Promise.resolve());
 const base='http://127.0.0.1:'+app.address.port;
 const res=await fetch(base+'/api/v1/skills');
 assert.equal(res.status,200);
 const initial=await res.json();
 assert.equal(initial.skills.mining.lock,'up');
 assert.equal(initial.total_cap,7000);
 const update=await fetch(base+'/api/v1/gameplay',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'skill_lock',skill:'mining',lock:'locked'})});
 assert.equal(update.status,200);
 assert.equal((await(await fetch(base+'/api/v1/skills')).json()).skills.mining.lock,'locked');
 const disk=JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8'));
 assert.equal(disk.characters['1'].skillbook.skills.mining.lock,'locked');
 assert.equal((await fetch(base+'/api/v1/skills',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 await app.close();
});
