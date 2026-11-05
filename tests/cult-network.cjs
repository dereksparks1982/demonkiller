'use strict';
// Cult board contracts: hidden hierarchy, evidence reveal, false leads, stale ranks.
const assert=require('node:assert/strict');
const Cult=require('../cult-system.js');
const Network=require('../cult-network.js');
const Population=require('../citizen-population.js');
const pop=Population.create('radial-board-seed');
const world=Cult.createWorld('radial-board-seed',[
 {id:'temple_ritualist',fixed:true,name:'Unknown robed figure',occupation:'Unknown'},
 ...Population.profiles(pop)]);
assert.equal(Network.BRANCHES.length,4,'Network has four branches around central mystery');
const original=Network.projection(world,Cult);
assert.equal(original.branches.length,4);
const members=original.branches.flatMap(b=>b.nodes);
assert(members.length>=1,'Fixed story participant is always included');
assert(members.some(p=>p.id==='temple_ritualist'),'Ritualist participates as a masked node');
assert(members.every(node=>node.name===null&&!node.confirmed),
 'Actual membership cannot expose identities without proof');
assert(original.branches.some(g=>g.nodes.length),'At least one branch has masked nodes');
assert.equal(original.confirmed,0);
assert.equal(original.leads.length,0);
assert.equal(Network.branchOf(world.citizens.temple_ritualist),'faith');
const victim=world.citizens.temple_ritualist;
Cult.meet(world,victim.id);
assert.equal(Network.projection(world,Cult).confirmed,0,
 'Ordinary acquaintance must not reveal membership');
const innocent={id:'innocent_public_official',name:'Public Official',occupation:'Magistrate',
 prominent:true,eligible:false};
Cult.addCitizen(world,innocent);
Cult.recordEvidence(world,innocent.id,{id:'rumor',kind:'suspicion',title:'Odd correspondence'});
let view=Network.projection(world,Cult);
assert.equal(view.leads.length,1,'False suspicion remains an unverified lead');
assert.equal(view.leads[0].name,'Public Official');
assert(!view.branches.flatMap(b=>b.nodes).some(node=>node.id===innocent.id),
 'Suspicion must not confirm a random innocent person as a member');
Cult.recordEvidence(world,victim.id,{id:'proof',kind:'membership',title:'A marked seal'});
view=Network.projection(world,Cult);
const known=view.branches.flatMap(b=>b.nodes).find(node=>node.id===victim.id);
assert(known.confirmed);
assert.equal(known.name,'Unknown robed figure');
assert.equal(known.clues.length,1);
assert.equal(view.confirmed,1);
assert.equal(view.leads.length,1,'Confirming a real member does not clear unrelated leads');
world.trackedCultistId=victim.id;
assert(Network.projection(world,Cult).branches.flatMap(b=>b.nodes)
 .find(node=>node.id===victim.id).tracking,'Tracking appears only after player selection');
Cult.kill(world,victim.id);
const after=Network.projection(world,Cult).branches.flatMap(b=>b.nodes).find(node=>node.id===victim.id);
assert(after,'A previous cultist does not vanish after death');
assert(after.eliminated,'Elimination is reflected on a previously confirmed card');
assert.equal(after.name,'Unknown robed figure');
Cult.recordEvidence(world,innocent.id,{id:'alibi',kind:'innocence',title:'A proven alibi'});
view=Network.projection(world,Cult);
assert.equal(view.leads.length,0,'Exonerated characters leave the unverified lead list');
const restored=Cult.restore(JSON.parse(JSON.stringify(world)));
assert.equal(Network.projection(restored,Cult).confirmed,1);
assert(Network.projection(restored,Cult).branches.flatMap(b=>b.nodes)
 .find(node=>node.id===victim.id).eliminated,'Board restores elimination from saved history');
console.log('PASS: four connected branches, masked silhouettes, true proof, false suspicion, tracking, death and save restore.');
