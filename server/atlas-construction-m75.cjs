'use strict';
// M75: actual sparse construction sites on the replacement world atlas.
// Every material must arrive from a persisted pack; labor is never instantaneous.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const GATHER=require('./atlas-gathering-m74.cjs');
const RECIPES=Object.freeze({
 shed:{width:2,height:2,stages:[
  {name:'foundation',work:3,items:{stone:2,clay:1}},
  {name:'frame',work:4,items:{timber:4}},
  {name:'roof',work:3,items:{timber:2,reeds:1}}
 ]},
 cottage:{width:3,height:3,stages:[
  {name:'foundation',work:5,items:{stone:4,clay:2}},
  {name:'frame',work:6,items:{timber:6}},
  {name:'roof',work:4,items:{timber:3,reeds:2}}
 ]}
});
const MAX_SITES=64,MAX_WORKERS=4,WORK_INTERVAL=15,MAX_SITE_STOCK=128;
const ITEMS=new Set(['timber','stone','clay','reeds']);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function blank(){return {schema:1,sequence:0,records:{}};}
function ensure(world){
 if(!world?.living)throw Error('Living world required');
 if(world.living.atlas_sites===undefined){
  world.living.atlas_sites=blank();return true;
 }
 validate(world);return false;
}
function inside(site,x,y){
 return x>=site.x&&x<site.x+site.width&&
  y>=site.y&&y<site.y+site.height;
}
function overlap(a,b){
 return a.x<b.x+b.width&&b.x<a.x+a.width&&
  a.y<b.y+b.height&&b.y<a.y+a.height;
}
function distance(site,x,y){
 const nx=Math.max(site.x,Math.min(x,site.x+site.width-1));
 const ny=Math.max(site.y,Math.min(y,site.y+site.height-1));
 return Math.abs(x-nx)+Math.abs(y-ny);
}
function blocks(world,x,y){
 return Object.values(world.living?.atlas_sites?.records||{}).some(s=>
  s.phase>=1&&inside(s,x,y));
}
function protectedTile(world,x,y){
 return Object.values(world.living?.atlas_sites?.records||{}).some(s=>inside(s,x,y));
}
function protectedCell(world,cx,cy){
 const b=GRID.cellBounds(cx,cy);
 return Object.values(world.living?.atlas_sites?.records||{}).some(s=>overlap(s,b));
}
function remaining(site){
 const result={};
 for(const stage of RECIPES[site.kind].stages.slice(site.phase))
  for(const [item,n] of Object.entries(stage.items))
   result[item]=(result[item]||0)+n;
 return result;
}
function needed(site){
 if(site.phase===3)return {};
 const result={};
 for(const [item,n] of Object.entries(RECIPES[site.kind].stages[site.phase].items)){
  if((site.inventory[item]||0)<n)result[item]=n-(site.inventory[item]||0);
 }
 return result;
}
function validate(world){
 const root=world?.living?.atlas_sites;
 if(root===undefined)return true;
 if(!root||root.schema!==1||Object.keys(root).sort().join(',')!=='records,schema,sequence'||
  !Number.isSafeInteger(root.sequence)||root.sequence<0||root.sequence>100000||
  !root.records||Array.isArray(root.records)||typeof root.records!=='object')
  throw Error('Invalid construction registry');
 const entries=Object.entries(root.records);
 if(entries.length>MAX_SITES)throw Error('Invalid construction site capacity');
 const workers=new Set();
 for(const [id,s] of entries){
  if(!/^atlas_site_[1-9][0-9]{0,5}$/.test(id)||!s||s.id!==id||
   Object.keys(s).sort().join(',')!==
    'created_minute,elevation,height,id,inventory,kind,phase,progress,width,workers,x,y'||
   !own(RECIPES,s.kind)||!Number.isSafeInteger(s.phase)||
   s.phase<0||s.phase>3||
   s.width!==RECIPES[s.kind].width||s.height!==RECIPES[s.kind].height||
   !Number.isSafeInteger(s.elevation)||s.elevation< -64||s.elevation>127||
   !Number.isSafeInteger(s.created_minute)||s.created_minute<0||
   s.created_minute>world.living.minute||
   !Number.isSafeInteger(s.progress)||s.progress<0||
   (s.phase===3?s.progress!==0:s.progress>=RECIPES[s.kind].stages[s.phase].work))
   throw Error('Invalid construction site');
  GRID.rectangle(s.x,s.y,s.width,s.height);
  if(!s.inventory||Array.isArray(s.inventory)||typeof s.inventory!=='object'||
   Object.keys(s.inventory).some(item=>!ITEMS.has(item))||
   Object.values(s.inventory).some(n=>!Number.isSafeInteger(n)||n<=0)||
   Object.values(s.inventory).reduce((n,v)=>n+v,0)>MAX_SITE_STOCK)
   throw Error('Invalid construction material stock');
  const left=remaining(s);
  for(const [item,qty] of Object.entries(s.inventory))
   if(qty>(left[item]||0))throw Error('Invalid construction material balance');
  if(!Array.isArray(s.workers)||s.workers.length>MAX_WORKERS||
   (s.phase===3&&s.workers.length))throw Error('Invalid construction crew');
  for(const npcId of s.workers){
   const npc=world.living.atlas_npcs?.records?.[npcId];
   if(!npc||npc.role!=='worker'||workers.has(npcId))
    throw Error('Invalid construction worker assignment');
   workers.add(npcId);
  }
 }
 for(let i=0;i<entries.length;i++)
  for(let j=i+1;j<entries.length;j++)
   if(overlap(entries[i][1],entries[j][1]))
    throw Error('Overlapping construction sites');
 return true;
}
function player(world){
 const p=world.characters?.['1']?.atlas_position;
 if(!p)throw Error('Enter the world to build');
 return p;
}
function accessible(site,actor){
 if(distance(site,actor.x,actor.y)>2)
  throw Error('Move next to the construction site first');
}
function siteById(world,id){
 if(typeof id!=='string'||!/^atlas_site_[1-9][0-9]{0,5}$/.test(id))
  throw Error('Invalid construction site ID');
 const site=world.living.atlas_sites.records[id];
 if(!site)throw Error('Unknown construction site');
 return site;
}
function addToPack(pack,item,qty){
 pack[item]=(pack[item]||0)+qty;
}
function takeFromPack(pack,item,qty){
 if(!Number.isSafeInteger(qty)||qty<1||(pack[item]||0)<qty)
  throw Error('Not enough carried materials');
 pack[item]-=qty;if(!pack[item])delete pack[item];
}
function place(world,command){
 if(!own(RECIPES,command.kind))throw Error('Invalid construction kind');
 const r=RECIPES[command.kind],site={x:command.x,y:command.y,
  width:r.width,height:r.height};
 GRID.rectangle(site.x,site.y,site.width,site.height);
 const p=player(world);
 accessible(site,p);
 if(Object.values(world.living.atlas_sites.records).some(old=>overlap(site,old))||
    Object.values(world.world_grid.buildings||{}).some(old=>overlap(site,old)))
  throw Error('Construction footprint overlaps another site or building');
 const people=[
  world.characters?.['1']?.atlas_position,world.world_grid.walker,
  ...Object.values(world.living.atlas_npcs?.records||{})
 ].filter(Boolean);
 const elevation=TERRAIN.readTile(world,site.x,site.y).elevation;
 for(let y=site.y;y<site.y+site.height;y++)
  for(let x=site.x;x<site.x+site.width;x++){
   const t=TERRAIN.readTile(world,x,y);
   if(TERRAIN.SOLID.has(t.material)||t.elevation!==elevation)
    throw Error('Construction needs level, passable terrain; flatten in DK Architect');
   if(people.some(a=>a.x===x&&a.y===y))
    throw Error('Construction footprint is occupied');
  }
 if(Object.keys(world.living.atlas_sites.records).length>=MAX_SITES)
  throw Error('Construction site limit reached');
 const root=world.living.atlas_sites,id='atlas_site_'+(++root.sequence);
 root.records[id]={id,kind:command.kind,...site,elevation,phase:0,progress:0,
  inventory:{},workers:[],created_minute:world.living.minute};
 return root.records[id];
}
function deliver(world,command){
 const s=siteById(world,command.site_id);accessible(s,player(world));
 if(s.phase===3)throw Error('Construction already finished');
 if(!ITEMS.has(command.item)||!Number.isSafeInteger(command.quantity)||
  command.quantity<1||command.quantity>8)
  throw Error('Invalid material delivery');
 const all=remaining(s);
 if((s.inventory[command.item]||0)+command.quantity>(all[command.item]||0))
  throw Error('Construction site does not need that many materials');
 const pack=world.living.atlas_resources.packs.player;
 takeFromPack(pack,command.item,command.quantity);
 addToPack(s.inventory,command.item,command.quantity);
 return s;
}
function work(world,s){
 if(s.phase===3)throw Error('Construction already finished');
 const stage=RECIPES[s.kind].stages[s.phase];
 if(Object.entries(stage.items).some(([name,qty])=>(s.inventory[name]||0)<qty))
  throw Error('Construction is waiting for delivered materials');
 s.progress++;
 if(s.progress<stage.work)return false;
 for(const [item,qty] of Object.entries(stage.items)){
  s.inventory[item]-=qty;
  if(!s.inventory[item])delete s.inventory[item];
 }
 s.phase++;s.progress=0;
 if(s.phase===3)s.workers=[];
 return true;
}
function assign(world,command,on){
 const s=siteById(world,command.site_id);accessible(s,player(world));
 if(s.phase===3)throw Error('Construction already finished');
 const npc=world.living.atlas_npcs.records[command.npc_id];
 if(!npc||npc.role!=='worker')throw Error('Assign a living worker NPC');
 if(on){
  if(distance(s,npc.x,npc.y)>2)throw Error('Worker must be stationed beside site');
  if(s.workers.includes(command.npc_id))throw Error('Worker already assigned');
  if(s.workers.length>=MAX_WORKERS)throw Error('Construction crew is full');
  for(const other of Object.values(world.living.atlas_sites.records))
   if(other.workers.includes(command.npc_id))
    throw Error('Worker is already assigned elsewhere');
  s.workers.push(command.npc_id);
 }else{
  if(!s.workers.includes(command.npc_id))throw Error('Worker not assigned here');
  s.workers=s.workers.filter(id=>id!==command.npc_id);
 }
 return s;
}
function cancel(world,command){
 const s=siteById(world,command.site_id);accessible(s,player(world));
 if(s.phase===3)throw Error('Completed buildings require demolition');
 const pack=world.living.atlas_resources.packs.player;
 const total=Object.values(pack).reduce((n,v)=>n+v,0)+
  Object.values(s.inventory).reduce((n,v)=>n+v,0);
 if(total>GATHER.MAX_PLAYER_CARRY)
  throw Error('Cannot refund materials; player pack is full');
 for(const [item,qty] of Object.entries(s.inventory))addToPack(pack,item,qty);
 delete world.living.atlas_sites.records[s.id];
 return s;
}
function emit(world,type,siteId,text){
 const l=world.living;
 const e={id:'event_'+(++l.event_sequence),minute:l.minute,type,
  site_id:siteId,text};
 l.events.push(e);if(l.events.length>512)l.events.shift();
 return e;
}
function perform(world,command){
 if(!world?.world_grid||!command||Array.isArray(command)||typeof command!=='object'||
  !Number.isSafeInteger(command.expected_revision))
  throw Error('Invalid construction command');
 if(command.expected_revision!==world.revision)throw Error('Stale world revision');
 const signatures={
  place:'action,expected_revision,kind,x,y',
  deliver:'action,expected_revision,item,quantity,site_id',
  labor:'action,expected_revision,site_id',
  assign:'action,expected_revision,npc_id,site_id',
  unassign:'action,expected_revision,npc_id,site_id',
  cancel:'action,expected_revision,site_id'
 };
 if(!own(signatures,command.action)||
    Object.keys(command).sort().join(',')!==signatures[command.action])
  throw Error('Invalid construction command fields');
 const next=structuredClone(world);
 ensure(next);GATHER.ensure(next);
 let site,description;
 if(command.action==='place'){
  site=place(next,command);
  description='Staked out a '+site.kind+' site; terrain is level';
 }else if(command.action==='deliver'){
  site=deliver(next,command);
  description='Delivered '+command.quantity+' '+command.item+' to '+site.id;
 }else if(command.action==='labor'){
  site=siteById(next,command.site_id);
  accessible(site,player(next));
  const before=site.phase;
  const done=work(next,site);
  description=done?'Completed '+RECIPES[site.kind].stages[before].name+
   ' at '+site.id:'Worked on '+site.id+' ('+site.progress+' strokes)';
 }else if(command.action==='assign'||command.action==='unassign'){
  site=assign(next,command,command.action==='assign');
  description=(command.action==='assign'?'Assigned ':'Released ')+command.npc_id+' at '+site.id;
 }else{
  site=cancel(next,command);
  description='Canceled site '+site.id+' and returned unused stock';
 }
 next.revision++;
 const event=emit(next,'atlas.construction.'+command.action,site.id,description);
 validate(next);
 return {world:next,event,site_id:site.id};
}
function pay(world,npc){
 const player=world.characters?.['1'];
 if(!player||!Number.isSafeInteger(player.gold)||player.gold<1)return false;
 if(!Number.isSafeInteger(npc.coins??0)||(npc.coins??0)>=1000000000)return false;
 player.gold-=1;player.revision++;
 npc.coins=(npc.coins||0)+1;
 return true;
}
function advance(world,minute,events=[]){
 if(minute%WORK_INTERVAL!==0)return 0;
 const root=world.living?.atlas_sites;
 if(!root)return 0;
 let count=0;
 for(const s of Object.values(root.records)){
  if(s.phase===3)continue;
  // One assigned worker performs at most one unit of work per interval.
  for(const workerId of [...s.workers]){
   if(s.phase===3)break;
   const npc=world.living.atlas_npcs?.records?.[workerId];
   if(!npc||npc.role!=='worker'||distance(s,npc.x,npc.y)>2)continue;
   const remainingStock=remaining(s);
   const pack=GATHER.inventory(world,workerId);
   // Paid physical delivery from the worker's own pack, no free materials.
   for(const item of Object.keys(remainingStock)){
    if((pack[item]||0)>0&&(s.inventory[item]||0)<remainingStock[item]){
     if(!pay(world,npc))break;
     const actual=world.living.atlas_resources.packs.npcs[workerId];
     takeFromPack(actual,item,1);
     addToPack(s.inventory,item,1);
     count++;break;
    }
   }
   const before=s.phase;
   if((world.characters?.['1']?.gold||0)<1)continue;
   if(Object.keys(needed(s)).length)continue;
   if(!pay(world,npc))continue;
   const complete=work(world,s);count++;
   if(complete){
     const e=emit(world,'atlas.construction.stage',s.id,
      s.id+' completed '+RECIPES[s.kind].stages[before].name);
     events.push(e);
   }
  }
 }
 return count;
}
function nearby(world,x,y,radius=12){
 const root=world.living?.atlas_sites;
 if(!root)return [];
 return Object.values(root.records)
  .filter(s=>s.x<=x+radius&&s.y<=y+radius&&
    s.x+s.width>x-radius&&s.y+s.height>y-radius)
  .map(s=>({id:s.id,kind:s.kind,x:s.x,y:s.y,width:s.width,height:s.height,
    elevation:s.elevation,phase:s.phase,
    stage:s.phase===3?'complete':RECIPES[s.kind].stages[s.phase].name,
    progress:s.progress,
    required:s.phase===3?{}:{...RECIPES[s.kind].stages[s.phase].items},
    work_required:s.phase===3?0:RECIPES[s.kind].stages[s.phase].work,
    missing:needed(s),stock:{...s.inventory},workers:[...s.workers]}));
}
module.exports=Object.freeze({ensure,validate,perform,advance,nearby,blocks,
 protectedTile,protectedCell,RECIPES,WORK_INTERVAL,MAX_SITES,remaining,needed});
