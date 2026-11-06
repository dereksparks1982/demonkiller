/* Demon Killer skill mastery/rust model, no wall-clock or offline drift.
 * Future profession actions call practice(); play client/server call advance()
 * with validated MEANINGFUL active character minutes only.
 */
(function(root){
  'use strict';
  const GRACE=60*24*60; // 60 days of active CHARACTER play, not server time
  const INTERVAL=7*24*60; // one tiny rust step per additional active week
  const RUST_STEP=.1;
  const MAX_LOSS=5;
  const round=n=>Math.round(n*1000)/1000;
  const bounded=n=>Number.isFinite(n)&&n>=0;
  const normalizedName=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{1,49}$/i.test(id);
  function create(){
    return {schema:1,activeMinutes:0,skills:Object.create(null)};
  }
  function safeEntry(raw,activeMinutes){
    if(!raw||typeof raw!=='object')return null;
    const mastery=Math.min(100,Math.max(0,Number(raw.mastery)||0));
    const current=Math.min(mastery,Math.max(0,Number(raw.current)||0));
    if(!mastery)return null;
    const last=Math.min(activeMinutes,Math.max(0,Number(raw.lastPracticeMinute)||0));
    return {mastery:round(mastery),
      current:round(Math.max(.001,current)),
      lastPracticeMinute:last};
  }
  function hydrate(raw){
    const p=create();
    if(!raw||raw.schema!==1||!bounded(raw.activeMinutes))return p;
    p.activeMinutes=Math.min(raw.activeMinutes,1e9);
    for(const [id,v] of Object.entries(raw.skills||{})){
      if(!normalizedName(id))continue;
      const item=safeEntry(v,p.activeMinutes);
      if(item)p.skills[id]=item;
    }
    return p;
  }
  function retentionFloor(mastery){
    // Any skill can decline, but nobody forgets a learned skill completely.
    return Math.min(mastery,Math.max(.001,mastery*.8,mastery-MAX_LOSS));
  }
  function advance(profile,minutes){
    if(!bounded(minutes))throw Error('Active-play minutes must be finite and nonnegative.');
    if(minutes===0)return profile;
    profile.activeMinutes=round(profile.activeMinutes+minutes);
    for(const entry of Object.values(profile.skills)){
      const inactive=profile.activeMinutes-entry.lastPracticeMinute;
      if(inactive<=GRACE+INTERVAL)continue;
      const steps=Math.floor((inactive-GRACE)/INTERVAL);
      const least=retentionFloor(entry.mastery);
      const proficiency=Math.max(least,entry.mastery-steps*RUST_STEP);
      entry.current=Math.min(entry.current,round(proficiency));
    }
    return profile;
  }
  function practice(profile,id,{difficulty=0,effort=.05}={}){
    if(!normalizedName(id))throw Error('Unrecognized skill identifier.');
    if(!bounded(difficulty)||difficulty>100||!bounded(effort)||effort>1)
      throw Error('Invalid difficulty or practice effort.');
    if(effort===0)return 0;
    const entry=profile.skills[id]||(profile.skills[id]={
      mastery:0,current:0,lastPracticeMinute:profile.activeMinutes
    });
    // Do harder, relevant work to keep learning. Beginner tasks eventually
    // provide negligible new mastery; recovered knowledge returns faster.
    const relevance=Math.max(.01,Math.min(1,(difficulty+10)/(entry.mastery+10)));
    const novice=entry.current<entry.mastery-.0001;
    const amount=round(effort*relevance*(novice?4:1));
    if(novice){
      const needed=entry.mastery-entry.current;
      const recovery=Math.min(needed,amount);
      entry.current=round(entry.current+recovery);
      const freshGain=Math.max(0,(amount-recovery)/4);
      if(freshGain){
        entry.current=round(Math.min(100,entry.current+freshGain));
        entry.mastery=round(Math.max(entry.mastery,entry.current));
      }
    }else{
      entry.current=round(Math.min(100,entry.current+amount));
      entry.mastery=round(Math.max(entry.mastery,entry.current));
    }
    entry.lastPracticeMinute=profile.activeMinutes;
    return amount;
  }
  function inspect(profile,id){
    const entry=profile.skills[id];return entry?Object.freeze({...entry}):null;
  }
  function snapshot(profile){
    return JSON.parse(JSON.stringify(profile));
  }
  const api=Object.freeze({GRACE_ACTIVE_MINUTES:GRACE,RUST_INTERVAL_ACTIVE_MINUTES:INTERVAL,
    MAX_LOSS,RUST_STEP,create,hydrate,advance,practice,inspect,snapshot,retentionFloor});
  root.DemonKillerSkills=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
