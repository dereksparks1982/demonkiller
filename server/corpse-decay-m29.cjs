'use strict';
// M29: deterministic, terrain-anchored remains. No client-side decay timers.
// World minutes drive both offline catch-up and visible appearance.
const {TEMPLE,COURT}=require('./regions.cjs');
const STAGES=Object.freeze(['fresh','early','decaying','skeletal','scattered']);
const SPECIES=Object.freeze({
  human:Object.freeze([0,180,720,2160,4320,10080]),
  demon:Object.freeze([0,90,360,1080,2160,4320]),
  beast:Object.freeze([0,120,480,1440,2880,7200])
});
const ENVIRONMENTS=Object.freeze({
  dry:2,
  damp:0.75,
  temperate:1
});
function environment(area){return area===TEMPLE?'dry':area===COURT?'damp':'temperate';}
function configure({kind='npc',species='human',area_id,minute=0,preserved=false}={}){
 if(!Object.hasOwn(SPECIES,species))throw Error('Unknown remains species');
 if(!['npc','monster'].includes(kind))throw Error('Unknown remains kind');
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid death minute');
 if(typeof preserved!=='boolean')throw Error('Invalid preservation setting');
 const climate=environment(area_id);
 const schedule=SPECIES[species].map(x=>Math.floor(x*ENVIRONMENTS[climate]));
 return {kind,species,environment:climate,preserved,looted:false,
   stage:'fresh',last_stage_minute:minute,
   expires_minute:preserved?null:minute+schedule[5]};
}
function schedule(c){
 const spec=SPECIES[c.species],factor=ENVIRONMENTS[c.environment];
 if(!spec||factor===undefined)throw Error('Invalid remains decay schedule');
 return spec.map(v=>Math.floor(v*factor));
}
function stageAt(c,minute){
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Invalid world minute');
 const age=Math.max(0,minute-c.created_minute),times=schedule(c);
 for(let index=STAGES.length-1;index>=0;index--)
  if(age>=times[index])return STAGES[index];
 return 'fresh';
}
function expired(c,minute){
 return !c.preserved&&minute>=c.expires_minute;
}
function view(c,minute){
 const stage=stageAt(c,minute),times=schedule(c),now=Math.max(0,minute-c.created_minute);
 const i=STAGES.indexOf(stage);
 return {stage,kind:c.kind,species:c.species,environment:c.environment,
  preserved:c.preserved,looted:c.looted,
  age_minutes:now,expires_minute:c.expires_minute,
  next_stage_minute:i<STAGES.length-1?c.created_minute+times[i+1]:null,
  can_search:i<4&&!c.looted&&Boolean(c.bag_id||c.coins)};
}
function migrate(c,minute=c.created_minute){
 if(c.stage!==undefined)return false;
 // Old M12 corpses expired after 720 minutes. Preserve their deaths,
 // backpack identities, loot state, and coordinates during M29 migration.
 const cfg=configure({kind:'npc',species:'human',area_id:c.area_id,
  minute:c.created_minute});
 Object.assign(c,cfg);
 c.stage=stageAt(c,minute);
 c.last_stage_minute=Math.max(c.created_minute,minute);
 return true;
}
function validate(c,minute){
 if(!c||!['npc','monster'].includes(c.kind)||
   !Object.hasOwn(SPECIES,c.species)||
   !Object.hasOwn(ENVIRONMENTS,c.environment)||
   typeof c.preserved!=='boolean'||typeof c.looted!=='boolean'||
   !STAGES.includes(c.stage)||
   !Number.isSafeInteger(c.last_stage_minute)||
   c.last_stage_minute<c.created_minute||c.last_stage_minute>minute||
   (c.preserved?c.expires_minute!==null:
    c.expires_minute!==c.created_minute+schedule(c)[5]))
  throw Error('Invalid M29 remains state');
 return true;
}
module.exports={STAGES,SPECIES,configure,environment,schedule,stageAt,expired,view,migrate,validate};
