'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../server/world.cjs'),R=require('../server/regions.cjs');
const G=require('../server/gameplay.cjs');
const FIELD=require('../server/field-skills-m43.cjs');
const COMBAT=require('../server/combat-m8.cjs');
const ENTITIES=require('../server/entity-registry-m10.cjs');
const {syncAll}=require('./helpers/sync-fixture.cjs');
const NOW=Date.UTC(2026,10,7,21);
function openPath(world){
 const area=world.areas[R.COURT];
 for(let y=5;y<area.height-5;y++)for(let x=5;x<area.width-5;x++)
  if([0,1,2].every(dx=>R.traversable(area,x+dx,y,'living')&&
   !R.portal(world,R.COURT,x+dx,y)))
   return {x,y};
 throw Error('No three-step legal courtyard walking path');
}
function scene(){
 let w=W.createCharacter(W.makeWorld(NOW),1,'ELIAS',NOW).world;
 const p=w.characters['1'],pos=openPath(w);
 p.form='living';p.opening_state='resurrected';
 p.area_id=R.COURT;p.x=pos.x;p.y=pos.y;
 syncAll(w);return w;
}
test('M52 existing M43 concealment saves migrate without resetting progress',()=>{
 const w=scene(),p=w.characters['1'];
 p.fieldcraft.hidden_until_minute=21;
 delete p.fieldcraft.stealth_steps;delete p.fieldcraft.camp_until_minute;
 assert.doesNotThrow(()=>FIELD.validate(p));
 assert.equal(FIELD.ensure(p),true);
 assert.equal(p.fieldcraft.hidden_until_minute,21);
 assert.equal(p.fieldcraft.stealth_steps,0);
 assert.equal(p.fieldcraft.camp_until_minute,-1);
 assert.equal(FIELD.ensure(p),false);
 W.validateWorld(w);
});
test('Hiding plus stealth allows legal cardinal steps but cannot provide infinite invisibility',()=>{
 let w=scene();w.living.minute=10;
 w=G.apply(w,{action:'use_skill',skill:'hiding'}).world;
 assert(w.characters['1'].fieldcraft.hidden_until_minute>10);
 w=G.apply(w,{action:'use_skill',skill:'stealth'}).world;
 assert.equal(w.characters['1'].fieldcraft.stealth_steps,2);
 assert.throws(()=>G.apply(w,{action:'use_skill',skill:'stealth'}),/cooldown/);
 const moved=W.applyCharacterAction(w,1,{action:'move',direction:'east'});
 w=moved.world;
 assert.equal(w.characters['1'].fieldcraft.stealth_steps,1);
 assert(w.characters['1'].fieldcraft.hidden_until_minute>10);
 assert(w.characters['1'].skillbook.skills.stealth.uses>=1);
 const end=W.applyCharacterAction(w,1,{action:'move',direction:'east'});
 assert.equal(end.character.fieldcraft.hidden_until_minute,-1);
 assert.equal(end.character.fieldcraft.stealth_steps,0);
 assert(end.events.some(e=>e.type==='player.stealth.exhausted'));
 W.validateWorld(end.world);
});
test('Monsters have a real chance to spot a sneaking character',()=>{
 let w=scene();w.living.minute=10;
 w=G.apply(w,{action:'use_skill',skill:'hiding'}).world;
 w=G.apply(w,{action:'use_skill',skill:'stealth'}).world;
 const p=w.characters['1'],events=[];
 COMBAT.spawn(w,R.COURT,10,events,1,'imp');
 const imp=Object.values(w.living.combat.creatures)[0];
 imp.x=p.x+1;imp.y=p.y;
 ENTITIES.reconcile(w);
 const result=W.applyCharacterAction(w,1,{action:'move',direction:'east'});
 assert.equal(result.character.fieldcraft.hidden_until_minute,-1);
 assert(result.events.some(e=>e.type==='player.stealth.detected'));
 W.validateWorld(result.world);
});
test('M52 outdoor camping consumes actual wood, increases needs and has a safe-area rule',()=>{
 let w=scene();w.living.minute=10;
 const p=w.characters['1'];p.inventory.wood=2;
 p.crafting.health=60;p.crafting.energy=40;
 ENTITIES.reconcile(w);
 const r=G.apply(w,{action:'use_skill',skill:'camping'});
 assert.equal(r.character.inventory.wood,1);
 assert.equal(r.character.crafting.health,65);
 assert.equal(r.character.crafting.energy,65);
 assert.equal(r.character.fieldcraft.camp_until_minute,40);
 assert(r.character.skillbook.skills.camping.uses>=1);
 assert.throws(()=>G.apply(r.world,{action:'use_skill',skill:'camping'}),/cooldown/);
 ENTITIES.counts(r.world);W.validateWorld(r.world);
});
test('M52 ghosts cannot set up living camp and monsters prevent unsafe resting',()=>{
 const w=scene();w.living.minute=10;
 const p=w.characters['1'];p.form='ghost';p.opening_state='complete';
 assert.throws(()=>G.apply(w,{action:'use_skill',skill:'camping'}),/living/);
 p.form='living';p.opening_state='resurrected';p.inventory.wood=2;
 COMBAT.spawn(w,R.COURT,10,[],1,'imp');
 const imp=Object.values(w.living.combat.creatures)[0];
 imp.x=p.x+1;imp.y=p.y;
 assert.throws(()=>G.apply(w,{action:'use_skill',skill:'camping'}),/Dangerous/);
});
