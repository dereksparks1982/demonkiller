/* Demon Killer cult simulation: deterministic per-world truth and separate player knowledge.
 * No external engine or dependencies. NPC names, regions and story revelations
 * are supplied by future authorized world content, not invented here.
 */
(function (root, factory) {
  const api=factory();
  if (typeof module === 'object' && module.exports) module.exports=api;
  if (root) root.DemonKillerCult=api;
})(typeof globalThis!=='undefined'?globalThis:this,function () {
  'use strict';
  const VERSION=1;
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(Number(n))?Number(n):0));
  const requireId=id=>{
    if(typeof id!=='string'||!/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(id))throw Error('Invalid citizen ID.');
    return id;
  };
  const hash=value=>{
    let h=2166136261;
    for (const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
    h^=h>>>16;h=Math.imul(h,0x7feb352d);
    h^=h>>>15;h=Math.imul(h,0x846ca68b);
    h^=h>>>16;return h>>>0;
  };
  const roll=(seed,key)=>hash(String(seed)+'|'+String(key))/4294967296;
  const clone=x=>JSON.parse(JSON.stringify(x));
  function valid(world){return !!(world&&world.version===VERSION&&
    typeof world.seed==='string'&&Number.isInteger(world.tick)&&world.tick>=0&&
    world.citizens&&typeof world.citizens==='object'&&!Array.isArray(world.citizens)&&
    world.knowledge&&typeof world.knowledge==='object'&&!Array.isArray(world.knowledge)&&
    Array.isArray(world.history));}
  function state(seed){return {version:VERSION,seed:String(seed),tick:0,citizens:Object.create(null),
    knowledge:Object.create(null),history:[]};}
  function citizen(world,id){if(!valid(world))throw Error('Invalid cult world.');
    requireId(id);const p=own(world.citizens,id)?world.citizens[id]:null;
    if(!p)throw Error('Unknown citizen: '+id);return p;}
  function createWorld(seed,profiles=[]){
    const w=state(seed);
    for(const profile of profiles)addCitizen(w,profile);
    return w;
  }
  function chance(p,w,includeTies=true) {
    const t=p.traits;
    const ties=includeTies?p.ties.filter(id=>own(w.citizens,id)&&w.citizens[id].active).length:0;
    return clamp(0.05+0.16*t.ambition+0.16*t.greed+
      0.12*t.fear+0.15*t.belief+0.14*Math.min(2,ties));
  }
  function addCitizen(world,profile){
    if(!valid(world)||!profile||typeof profile!=='object')throw Error('Invalid citizen.');
    const id=requireId(profile.id);
    if(own(world.citizens,id))return world.citizens[id];
    const traits=profile.traits||{};
    const fixed=profile.fixed===true;
    const p={id,name:String(profile.name||'Unknown'),occupation:String(profile.occupation||'Unknown'),
      prominent:profile.prominent===true,region:String(profile.region||''),
      traits:{ambition:clamp(traits.ambition),greed:clamp(traits.greed),
        fear:clamp(traits.fear),belief:clamp(traits.belief)},
      ties:Array.isArray(profile.ties)?profile.ties.filter(x=>typeof x==='string'&&x!==id):[],
      fixed,everMember:fixed,active:fixed,alive:true,rank:fixed?(profile.rank==='founder'?'founder':'member'):'none',
      branch:String(profile.branch||''),joinTick:fixed?0:null};
    world.citizens[id]=p;
    // Initial allegiances are stable for a world seed, independent of iteration order.
    if(!fixed&&profile.eligible!==false&&roll(world.seed,'initial:'+id)<chance(p,world,false)){
      p.active=true;p.everMember=true;p.rank='member';p.joinTick=0;
    }
    return p;
  }
  function meet(world,id){
    citizen(world,id);
    if(!own(world.knowledge,id))world.knowledge[id]={met:true,evidence:[],intel:null};
    else world.knowledge[id].met=true;
    return dossier(world,id);
  }
  function recordEvidence(world,id,evidence){
    const p=citizen(world,id);
    if(!evidence||typeof evidence.id!=='string'||!evidence.id.trim()||
        !['suspicion','membership','innocence','rank'].includes(evidence.kind))
      throw Error('Invalid evidence.');
    if((evidence.kind==='membership'||evidence.kind==='rank')&&!p.active)
      throw Error('Proof of current cult activity requires an active cult member.');
    if(evidence.kind==='innocence'&&p.active)throw Error('Cannot exonerate an active cult member.');
    meet(world,id);
    const k=world.knowledge[id];
    if(k.evidence.some(e=>e.id===evidence.id))return dossier(world,id);
    k.evidence.push({id:evidence.id,kind:evidence.kind,title:String(evidence.title||'Evidence'),
      source:String(evidence.source||''),tick:world.tick});
    if(evidence.kind==='membership')k.intel={status:'confirmed',rank:'unknown',tick:world.tick};
    if(evidence.kind==='rank')k.intel={status:'confirmed',rank:p.rank,tick:world.tick};
    if(evidence.kind==='innocence')k.intel={status:'cleared',rank:'unknown',tick:world.tick};
    if(evidence.kind==='suspicion'&&!k.intel)k.intel={status:'suspected',rank:'unknown',tick:world.tick};
    return dossier(world,id);
  }
  function dossier(world,id) {
    const p=citizen(world,id),k=own(world.knowledge,id)?world.knowledge[id]:null;
    if(!k||!k.met)return null; // Meeting someone never discloses secret allegiance.
    const intel=k.intel||{status:'unknown',rank:'unknown',tick:null};
    return {id:p.id,name:p.name,occupation:p.occupation,prominent:p.prominent,region:p.region,
      affiliation:intel.status,rank:intel.rank,lastVerifiedTick:intel.tick,
      evidence:clone(k.evidence),alive: null}; // No unobserved changes leak through dossiers.
  }
  function board(world){
    if(!valid(world))throw Error('Invalid cult world.');
    return Object.keys(world.knowledge).map(id=>dossier(world,id))
      .filter(d=>d&&(d.affiliation==='suspected'||d.affiliation==='confirmed'))
      .sort((a,b)=>a.name.localeCompare(b.name));
  }
  function historical(world,kind,id,other){
    world.history.push({tick:world.tick,kind,id,other:other||null});
    if(world.history.length>1000)world.history.shift();
  }
  function recruit(world,id,opts={}){
    const p=citizen(world,id);if(p.fixed||p.active||!p.alive)return false;
    if(opts.by){const sponsor=citizen(world,opts.by);
      if(!sponsor.active||!sponsor.alive)return false;
    }else if(!p.ties.some(t=>own(world.citizens,t)&&world.citizens[t].active))return false;
    const pressure=clamp(opts.pressure||0);
    world.tick++;
    const accepted=roll(world.seed,'recruit:'+id+':'+world.tick)<clamp(chance(p,world)+pressure*.45);
    historical(world,accepted?'recruited':'recruitment_failed',id,opts.by);
    if(accepted){p.active=true;p.everMember=true;p.rank='member';p.joinTick=world.tick;}
    return accepted;
  }
  function depart(world,id){
    const p=citizen(world,id);
    if(!p.active||p.fixed||!p.alive)return false;
    world.tick++;p.active=false;p.rank='none';
    historical(world,'departed',id);return true;
  }
  function kill(world,id){
    const p=citizen(world,id);if(!p.alive)return false;
    world.tick++;p.alive=false;p.active=false;p.rank='none';historical(world,'killed',id);return true;
  }
  function promote(world,id,branch){
    const p=citizen(world,id);
    if(!p.active||!p.alive||p.rank==='founder')return false;
    const target=String(branch||p.branch);
    if(!target)throw Error('Leadership requires a named branch.');
    if(Object.values(world.citizens).some(x=>x.id!==id&&x.active&&x.alive&&x.branch===target&&x.rank==='leader'))
      return false;
    world.tick++;p.branch=target;p.rank='leader';historical(world,'promoted',id,target);return true;
  }
  function changeCircumstances(world,id,traits){
    const p=citizen(world,id);if(!traits||typeof traits!=='object')return p;
    for(const key of ['ambition','greed','fear','belief'])if(own(traits,key))p.traits[key]=clamp(traits[key]);
    world.tick++;historical(world,'circumstances_changed',id);
    return p;
  }
  function availableVacancies(world){
    if(!valid(world))throw Error('Invalid cult world.');
    const branches=new Set(Object.values(world.citizens).filter(p=>p.branch&&p.everMember).map(p=>p.branch));
    return [...branches].filter(branch=>!Object.values(world.citizens)
      .some(p=>p.branch===branch&&p.active&&p.alive&&p.rank==='leader'));
  }
  function restore(data){if(!valid(data))throw Error('Invalid cult save.');
    return clone(data);}
  return Object.freeze({VERSION,valid,createWorld,addCitizen,meet,recordEvidence,dossier,board,
    recruit,depart,kill,promote,changeCircumstances,availableVacancies,restore});
});
