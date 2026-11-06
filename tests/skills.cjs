'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Skills=require('../dk-skills.js');
const DAY=1440;
test('every learned skill can rust after months of CHARACTER play',()=>{
  const p=Skills.create();Skills.practice(p,'mining',{difficulty:100,effort:1});
  assert(Skills.inspect(p,'mining').current>0);
  Skills.advance(p,59*DAY);
  assert.equal(Skills.inspect(p,'mining').current,Skills.inspect(p,'mining').mastery);
  Skills.advance(p,9*DAY);
  assert(Skills.inspect(p,'mining').current<Skills.inspect(p,'mining').mastery);
});
test('low skills never rust to zero and high mastery loses at most five points',()=>{
  const p=Skills.create();
  Skills.practice(p,'mining',{difficulty:100,effort:1});
  for(let i=0;i<100;i++)Skills.practice(p,'taming',{difficulty:100,effort:1});
  const high=Skills.inspect(p,'taming').mastery;
  Skills.advance(p,800*DAY);
  assert(Skills.inspect(p,'mining').current>0);
  assert(Skills.inspect(p,'taming').current>=high-5);
});
test('offline time never advances the character play clock',()=>{
  const p=Skills.create();Skills.practice(p,'alchemy',{difficulty:100,effort:1});
  const saved=Skills.snapshot(p),future=Skills.hydrate(saved);
  assert.equal(future.activeMinutes,saved.activeMinutes);
  assert.deepEqual(Skills.inspect(future,'alchemy'),Skills.inspect(p,'alchemy'));
});
test('occasional practice resets disuse and lost expertise comes back faster',()=>{
  const p=Skills.create();
  Skills.practice(p,'mining',{difficulty:100,effort:1});
  Skills.advance(p,70*DAY);
  const old=Skills.inspect(p,'mining');
  Skills.practice(p,'mining',{difficulty:100,effort:.05});
  assert(Skills.inspect(p,'mining').current>old.current);
  const after=Skills.inspect(p,'mining');
  Skills.advance(p,25*DAY);
  assert.equal(Skills.inspect(p,'mining').current,after.current);
});
test('invalid clock and bogus injected skill metadata are rejected or sanitized',()=>{
  const p=Skills.hydrate({schema:1,activeMinutes:500,skills:{
    '':{mastery:100,current:100,lastPracticeMinute:100},
    mining:{mastery:20,current:1000,lastPracticeMinute:Infinity}
  }});
  assert.equal(Skills.inspect(p,'mining').current,20);
  assert.equal(Object.keys(p.skills).length,1);
  assert.throws(()=>Skills.advance(p,-1));
  assert.throws(()=>Skills.practice(p,'mining',{difficulty:999}));
});
