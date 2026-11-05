'use strict';
// Population contract: seed stability, diversity, public views, daily life and save round trips.
const assert=require('node:assert/strict');
const Population=require('../citizen-population.js');
const Cult=require('../cult-system.js');
assert.equal(Population.COUNT,24);
const a=Population.create('village-A'),b=Population.create('village-A');
const c=Population.create('village-B');
assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),
 'Identical world seeds produce identical civilian identities, traits, contacts and schedules');
assert.notDeepEqual(Population.publicRegister(a),Population.publicRegister(c),
 'New worlds should have a different collection of civilian identities');
assert(Population.validate(a));
const publicPeople=Population.publicRegister(a);
assert.equal(publicPeople.length,24);
assert.equal(new Set(publicPeople.map(p=>p.id)).size,24,'NPC IDs must be unique');
assert.equal(new Set(publicPeople.map(p=>p.name)).size,24,'Generated names must be unique');
assert(publicPeople.filter(p=>p.prominent).length>=8,'Society should include prominent citizens');
assert(publicPeople.some(p=>!p.prominent),'Society should include ordinary citizens');
for(const p of publicPeople){
  assert.equal(typeof p.listedHours,'string');
  for(const hidden of ['traits','contacts','fixed','active','rank','branch','everMember'])
    assert.equal(Object.hasOwn(p,hidden),false,'Public records must not reveal '+hidden);
}
const profiles=Population.profiles(a);
assert.equal(profiles.length,24);
assert(profiles.every(p=>p.eligible===true&&p.fixed!==true));
const ids=new Set(profiles.map(p=>p.id));
for(const p of profiles)for(const tie of p.ties){
  assert(ids.has(tie)&&tie!==p.id,'Relations must reference another member of society');
  assert(Population.profiles(a).find(other=>other.id===tie).ties.includes(p.id),
   'Social connections must be reciprocal');
}
const worldA=Cult.createWorld('village-A',[{id:'temple_ritualist',fixed:true},...profiles]);
const worldB=Cult.createWorld('village-B',
  [{id:'temple_ritualist',fixed:true},...Population.profiles(c)]);
assert.equal(Cult.board(worldA).length,0,'Seeded actual cult membership is not publicly revealed');
assert.notEqual(
  profiles.filter(x=>worldA.citizens[x.id].active).map(x=>x.id).join(','),
  Population.profiles(c).filter(x=>worldB.citizens[x.id].active).map(x=>x.id).join(','),
  'Membership should vary between playthroughs');
assert(profiles.some(p=>p.prominent&&!worldA.citizens[p.id].active),
 'At least some prominent citizens must remain innocent');
const night='citizen_night_watch',day='citizen_magistrate';
assert.equal(Population.whereabouts(a,night).activity,'resting','Night watch rests in daytime');
assert.equal(Population.whereabouts(a,day).activity,'working','Magistrate works by day');
const firstTime=Population.advanceHours(a,12);
assert.deepEqual(firstTime,{day:0,hour:21});
assert.equal(Population.whereabouts(a,night).activity,'working','Night watch works at night');
assert.equal(Population.whereabouts(a,day).activity==='working',false,'Magistrate is off duty late');
assert.deepEqual(Population.advanceHours(a,10),{day:1,hour:7},'Time wraps to next day');
assert.equal(Population.whereabouts(a,night).activity,'resting','Watchman sleeps after shift');
assert.throws(()=>Population.advanceHours(a,0));
assert.throws(()=>Population.advanceHours(a,169));
assert.throws(()=>Population.advanceHours(a,0.5));
const restored=Population.restore(JSON.parse(JSON.stringify(a)));
assert.deepEqual(restored,JSON.parse(JSON.stringify(a)),'Population state survives saved JSON');
assert.throws(()=>Population.restore({version:1,seed:'bad'}));
assert.throws(()=>Population.publicRecord(a,'unknown'));
console.log('PASS: 24 citizens, seeded identities, social ties, varied membership, public privacy, shifts, day rollover, persistence.');
