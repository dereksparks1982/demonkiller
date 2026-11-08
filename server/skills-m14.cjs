'use strict';
// M14: independently implemented UO-inspired skill growth and skill locks.
// Fixed tenths of a point: 1000 = 100.0, total skill cap = 700.0.
// M41: a full UO-inspired trade/war/magic/rogue skillbook. No RunUO code.
const SKILL_GROUPS=Object.freeze({
 combat:['wrestling','swordsmanship','fencing','mace_fighting','archery',
  'tactics','anatomy','parrying','healing','resisting_spells','focus'],
 magic:['magery','meditation','evaluating_intelligence','inscription',
  'necromancy','spirit_speak','chivalry','spellweaving'],
 gathering:['herbalism','lumberjacking','mining','fishing','farming','tracking',
  'forensic_evaluation','animal_lore','camping'],
 crafting:['blacksmithing','carpentry','tailoring','tinkering','cooking','milling',
  'alchemy','bowcraft','fletching','cartography','item_identification',
  'taste_identification','arms_lore','survival'],
 roguery:['hiding','stealth','detect_hidden','lockpicking','remove_trap',
  'snooping','stealing','poisoning'],
 social:['trading','begging','musicianship','peacemaking','provocation',
  'discordance','animal_taming','veterinary','leadership']
});
const SKILL_NAMES=Object.freeze(Object.values(SKILL_GROUPS).flat());
const LOCKS=Object.freeze(['up','down','locked']);
const INDIVIDUAL_CAP=1000,TOTAL_CAP=7000;
function clean(skill){return SKILL_NAMES.includes(skill);}
function initial(value=0){
 return {value:Math.max(0,Math.min(INDIVIDUAL_CAP,value)),
  lock:'up',uses:0,last_gain_minute:-1,last_source:null,
  last_source_minute:-1,repetitions:0};
}
function legacyValue(value){
 return Number.isSafeInteger(value)&&value>0?
  Math.min(INDIVIDUAL_CAP,Math.floor(value)):0;
}
function ensure(character){
 if(!character)return false;
 if(character.skillbook){
  const book=character.skillbook;
  if(book.schema!==1||!book.skills||Array.isArray(book.skills))
   throw Error('Cannot migrate malformed skillbook');
  let changed=false;
  for(const name of SKILL_NAMES)if(!book.skills[name]){
   book.skills[name]=initial();changed=true;
  }
  return changed;
 }
 const exp=character.skills||{},craft=character.crafting||{};
 const old={herbalism:legacyValue(exp.foraging),trading:legacyValue(exp.commerce),
   tactics:legacyValue(exp.combat),survival:legacyValue(craft.skill)};
 const records=Object.fromEntries(SKILL_NAMES.map(name=>[name,initial(old[name]||0)]));
 character.skillbook={schema:1,total_cap:TOTAL_CAP,skills:records};
 return true;
}
function total(character){
 const s=character.skillbook;
 if(!s)return 0;
 return Object.values(s.skills).reduce((n,skill)=>n+skill.value,0);
}
function validate(character){
 const b=character?.skillbook;
 if(!b)return true; // Older saves are migrated on startup.
 if(b.schema!==1||b.total_cap!==TOTAL_CAP||!b.skills||
    Array.isArray(b.skills)||Object.keys(b.skills).length!==SKILL_NAMES.length)
  throw Error('Invalid skillbook schema');
 for(const name of SKILL_NAMES){
  const s=b.skills[name];
  if(!s||!Number.isSafeInteger(s.value)||s.value<0||s.value>INDIVIDUAL_CAP||
    !LOCKS.includes(s.lock)||!Number.isSafeInteger(s.uses)||s.uses<0||s.uses>1e9||
    !Number.isSafeInteger(s.last_gain_minute)||s.last_gain_minute<-1||
    !Number.isSafeInteger(s.last_source_minute)||s.last_source_minute<-1||
    !Number.isSafeInteger(s.repetitions)||s.repetitions<0||s.repetitions>1e7||
    (s.last_source!==null&&(typeof s.last_source!=='string'||
      s.last_source.length>128)))
    throw Error('Invalid skill record');
 }
 if(Object.keys(b.skills).some(name=>!clean(name))||total(character)>TOTAL_CAP)
  throw Error('Skill cap exceeded');
 return true;
}
function practice(character,name,minute,source){
 if(!clean(name)||!Number.isSafeInteger(minute)||minute<0||
   typeof source!=='string'||source.length<1||source.length>128)
  throw Error('Invalid skill use');
 ensure(character);
 const record=character.skillbook.skills[name];
 if(record.uses>=1e9)throw Error('Skill use counter exceeded');
 record.uses++;
 // Repeating an identical target/location is not an unlimited skill pump.
 const repeated=source===record.last_source&&
   record.last_source_minute>=0&&minute-record.last_source_minute<15;
 record.repetitions=repeated?record.repetitions+1:1;
 record.last_source=source;record.last_source_minute=minute;
 if(record.lock!=='up'||record.value>=INDIVIDUAL_CAP||
   record.repetitions>3)return {skill:name,gained:0,value:record.value};
 const gap=1+Math.floor(record.value/200);
 if(record.last_gain_minute>=0&&minute-record.last_gain_minute<gap)
  return {skill:name,gained:0,value:record.value};
 if(total(character)>=TOTAL_CAP){
  const down=SKILL_NAMES.map(name=>({name,entry:character.skillbook.skills[name]}))
   .filter(x=>x.entry.lock==='down'&&x.entry.value>0)
   .sort((a,b)=>b.entry.value-a.entry.value||a.name.localeCompare(b.name))[0];
  if(!down)return {skill:name,gained:0,value:record.value};
  down.entry.value--;
 }
 record.value++;
 record.last_gain_minute=minute;
 validate(character);
 return {skill:name,gained:1,value:record.value};
}
function publicRecord(character){
 if(!character)return null;
 ensure(character);
 return {schema:1,total_cap:TOTAL_CAP,total:total(character),
   groups:SKILL_GROUPS,
   skills:Object.fromEntries(SKILL_NAMES.map(name=>{
    const s=character.skillbook.skills[name];
    return [name,{value:s.value,lock:s.lock,uses:s.uses}];
   }))};
}
function applyLock(world,command){
 if(!command||typeof command!=='object'||Array.isArray(command)||
  Object.keys(command).sort().join(',')!=='action,lock,skill'||
  command.action!=='skill_lock'||!clean(command.skill)||
  !LOCKS.includes(command.lock))
  throw Error('Invalid skill lock action');
 if(!world.runtime?.running)throw Error('World is paused');
 const current=world.characters?.['1'];
 if(!current)throw Error('No character exists');
 const next=structuredClone(world),player=next.characters['1'];
 ensure(player);
 const old=player.skillbook.skills[command.skill].lock;
 if(old===command.lock)throw Error('Skill already uses that lock');
 player.skillbook.skills[command.skill].lock=command.lock;
 const minute=next.living.minute;
 player.revision++;next.revision++;
 const l=next.living,e={id:'event_'+(++l.event_sequence),
  minute,type:'skill.lock.changed',
  text:'A character skill training direction changed.',
  skill:command.skill,from:old,to:command.lock,slot:1};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 validate(player);
 return {world:next,character:player,event:e};
}
module.exports={SKILL_NAMES,SKILL_GROUPS,LOCKS,INDIVIDUAL_CAP,TOTAL_CAP,
 ensure,validate,total,practice,publicRecord,applyLock};
