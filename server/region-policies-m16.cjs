'use strict';
// DK Server M16: RunUO-inspired priority subregions, independently implemented.
// Every map keeps its own dimensions; the world decides current region policy.
const {TEMPLE,COURT,VILLAGE}=require('./regions.cjs');
const DEFINITIONS=Object.freeze([
 {id:'dk.region.temple.sanctuary',area_id:TEMPLE,name:'Forsaken Temple',
  priority:10,bounds:[0,0,15,15],guarded:false,housing:false},
 {id:'dk.region.courtyard.willow',area_id:COURT,name:'Lilith\'s Willow',
  priority:90,bounds:[25,19,40,36],guarded:false,housing:false},
 {id:'dk.region.courtyard.temple_grounds',area_id:COURT,name:'Temple Grounds',
  priority:80,bounds:[20,38,43,63],guarded:false,housing:false},
 {id:'dk.region.courtyard.homes',area_id:COURT,name:'Courtyard Homes',
  priority:15,bounds:[0,0,63,63],guarded:false,housing:true},
 {id:'dk.region.village.bank',area_id:VILLAGE,name:'Bank Quarter',
  priority:90,bounds:[43,86,66,110],guarded:true,housing:false},
 {id:'dk.region.village.market',area_id:VILLAGE,name:'Market Square',
  priority:85,bounds:[55,56,86,87],guarded:true,housing:false},
 {id:'dk.region.village.smiths',area_id:VILLAGE,name:'Smiths Quarter',
  priority:80,bounds:[16,102,45,126],guarded:true,housing:false},
 {id:'dk.region.village.north_gate',area_id:VILLAGE,name:'Northern Gate',
  priority:70,bounds:[55,0,75,33],guarded:true,housing:false},
 {id:'dk.region.village.homes',area_id:VILLAGE,name:'Village Residential',
  priority:10,bounds:[0,0,127,127],guarded:true,housing:true}
]);
const IDS=new Set(DEFINITIONS.map(d=>d.id));
const INDEX=Object.freeze(Object.fromEntries(DEFINITIONS.map(d=>[d.id,d])));
function regionAt(world,area_id,x,y){
  const area=world.areas?.[area_id];
  if(!area||!Number.isInteger(x)||!Number.isInteger(y)||
     x<0||y<0||x>=area.width||y>=area.height)
    throw Error('Invalid region position');
  const found=DEFINITIONS.filter(r=>r.area_id===area_id&&
    x>=r.bounds[0]&&y>=r.bounds[1]&&x<=r.bounds[2]&&y<=r.bounds[3])
    .sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))[0];
  if(!found)throw Error('No region policy for world tile');
  const occupied=world.living?.territories?.[area_id]?.control==='monsters';
  return {...found,guarded:found.guarded&&!occupied,
    occupied,territory:occupied?'monsters':'settlers'};
}
function ensure(world){
  if(!world.living)throw Error('Regions require a living world');
  let changed=false;
  if(!world.living.region_history){
    world.living.region_history={schema:1,records:{}};changed=true;
  }
  const history=world.living.region_history;
  const player=world.characters?.['1'];
  if(player){
    const p=regionAt(world,player.area_id,player.x??8,player.y??12);
    if(!player.region_id||!IDS.has(player.region_id)){
      player.region_id=p.id;changed=true;
    }
    if(!history.records[p.id]){
      history.records[p.id]={player_visits:1,npc_visits:0,
        first_minute:world.living.minute,last_minute:world.living.minute};
      changed=true;
    }
  }
  for(const n of Object.values(world.living.npcs||{})){
    const p=regionAt(world,n.area_id,n.x,n.y);
    if(!n.region_id||!IDS.has(n.region_id)){
      n.region_id=p.id;changed=true;
    }
  }
  return changed;
}
function track(world,id,minute,player){
  const h=world.living.region_history;
  if(!h.records[id])h.records[id]={player_visits:0,npc_visits:0,
    first_minute:minute,last_minute:minute};
  const r=h.records[id];
  r[player?'player_visits':'npc_visits']++;
  r.last_minute=minute;
}
function event(world,minute,type,details){
  const living=world.living;
  const e={id:'event_'+(++living.event_sequence),minute,
    type,text:type==='player.region.exit'?'The player left '+details.from_name+'.':
    type==='player.region.enter'?'The player entered '+details.to_name+'.':
    'An NPC entered '+details.to_name+'.',...details};
  living.events.push(e);
  if(living.events.length>512)living.events.shift();
  return e;
}
function onPlayerMove(world,previous){
  const c=world.characters?.['1'];
  if(!c)return [];
  const old=regionAt(world,previous.area_id,previous.x??8,previous.y??12);
  const next=regionAt(world,c.area_id,c.x??8,c.y??12);
  // ensure() records the first visit to a new district. Do not count it
  // again just because movement also crossed a district boundary.
  const recorded=Boolean(world.living?.region_history?.records?.[next.id]);
  ensure(world);
  c.region_id=next.id;
  if(old.id===next.id)return [];
  const minute=world.living.minute;
  if(recorded)track(world,next.id,minute,true);
  return [
    event(world,minute,'player.region.exit',{slot:1,from:old.id,to:next.id,
      from_name:old.name,to_name:next.name,area_id:old.area_id}),
    event(world,minute,'player.region.enter',{slot:1,from:old.id,to:next.id,
      from_name:old.name,to_name:next.name,area_id:next.area_id,
      guarded:next.guarded})
  ];
}
function onNpcMove(world,n,previous,minute,events){
  ensure(world);
  const old=regionAt(world,previous.area_id,previous.x,previous.y);
  const next=regionAt(world,n.area_id,n.x,n.y);
  n.region_id=next.id;
  if(old.id===next.id)return;
  track(world,next.id,minute,false);
  events.push(event(world,minute,'npc.region.enter',{
    npc_id:n.id,from:old.id,to:next.id,to_name:next.name,
    area_id:next.area_id,guarded:next.guarded}));
}
function syncNpcTransitions(world,minute,events){
 ensure(world);
 for(const n of Object.values(world.living.npcs||{})){
  const region=regionAt(world,n.area_id,n.x,n.y);
  if(n.region_id===region.id)continue;
  // Use the last-known policy ID rather than inventing an old tile.
  const previousId=n.region_id;
  n.region_id=region.id;
  if(!n.alive)continue; // A corpse isn't a living visitor.
  track(world,region.id,minute,false);
  events.push(event(world,minute,'npc.region.enter',{
   npc_id:n.id,from:previousId,to:region.id,to_name:region.name,
   area_id:region.area_id,guarded:region.guarded}));
 }
}
function validate(world){
 const state=world.living?.region_history;
 if(!state)return true; // migrate M13 worlds
 if(state.schema!==1||!state.records||Array.isArray(state.records))
   throw Error('Invalid region history');
 for(const [id,r] of Object.entries(state.records))
  if(!IDS.has(id)||!r||!Number.isSafeInteger(r.player_visits)||
    !Number.isSafeInteger(r.npc_visits)||r.player_visits<0||r.npc_visits<0||
    !Number.isSafeInteger(r.first_minute)||r.first_minute<0||
    !Number.isSafeInteger(r.last_minute)||r.last_minute<r.first_minute)
   throw Error('Invalid saved region visit');
 const player=world.characters?.['1'];
 if(player?.region_id!==undefined&&(!IDS.has(player.region_id)||
    player.region_id!==regionAt(world,player.area_id,player.x??8,player.y??12).id))
  throw Error('Player region identity disagrees with location');
 for(const n of Object.values(world.living?.npcs||{})){
  if(n.region_id!==undefined&&(!IDS.has(n.region_id)||
     n.region_id!==regionAt(world,n.area_id,n.x,n.y).id))
   throw Error('NPC region identity disagrees with location');
 }
 return true;
}
function current(world){
 const c=world.characters?.['1'];if(!c)return null;
 const r=regionAt(world,c.area_id,c.x??8,c.y??12);
 return {region:r,record:world.living.region_history?.records[r.id]||null,
   area_id:c.area_id,revision:world.revision};
}
module.exports={DEFINITIONS,INDEX,IDS,regionAt,ensure,onPlayerMove,onNpcMove,syncNpcTransitions,validate,current};
