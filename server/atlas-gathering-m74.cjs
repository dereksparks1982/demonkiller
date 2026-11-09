'use strict';
// M74. Finite terrain-based gathering for the replacement atlas.
// Inventory, regrowth, and NPC labor are authoritative and saved by DK Server.
const GRID=require('./world-grid-m67.cjs');
const TERRAIN=require('./world-terrain-editor-m69.cjs');
const RESOURCE=Object.freeze({
 forest:{item:'timber',job:'forager'},pine:{item:'timber',job:'forager'},
 heath:{item:'herbs',job:'forager'},marsh:{item:'reeds',job:'forager'},
 bog:{item:'reeds',job:'forager'},reed:{item:'reeds',job:'forager'},
 highland:{item:'stone',job:'worker'},cliff:{item:'stone',job:'worker'},
 stone:{item:'stone',job:'worker'},dirt:{item:'clay',job:'worker'},
 beach:{item:'clay',job:'worker'}
});
const ITEMS=new Set(['timber','herbs','reeds','stone','clay']);
const REGEN_MINUTES=360,WORK_INTERVAL=60,MAX_NODES=4096;
const MAX_PLAYER_CARRY=64,MAX_NPC_CARRY=24;
function newStore(){return {schema:1,nodes:{},packs:{player:{},npcs:{}}};}
function ensure(world){
 if(!world?.living)throw Error('Living world required');
 if(world.living.atlas_resources===undefined){
  world.living.atlas_resources=newStore();return true;
 }
 validate(world);return false;
}
function validPack(pack,cap){
 if(!pack||Array.isArray(pack)||typeof pack!=='object'||
    Object.values(pack).some(v=>!Number.isSafeInteger(v)||v<1||v>cap)||
    Object.keys(pack).some(k=>!ITEMS.has(k))||
    Object.values(pack).reduce((n,v)=>n+v,0)>cap)
  throw Error('Invalid atlas resource inventory');
}
function validate(world){
 const s=world?.living?.atlas_resources;
 if(s===undefined)return true;
 if(!s||s.schema!==1||Object.keys(s).sort().join(',')!=='nodes,packs,schema'||
    !s.nodes||Array.isArray(s.nodes)||typeof s.nodes!=='object'||
    Object.keys(s.nodes).length>MAX_NODES||
    !s.packs||Array.isArray(s.packs)||typeof s.packs!=='object'||
    Object.keys(s.packs).sort().join(',')!=='npcs,player'||
    !s.packs.npcs||Array.isArray(s.packs.npcs)||typeof s.packs.npcs!=='object')
  throw Error('Invalid atlas resource store');
 validPack(s.packs.player,MAX_PLAYER_CARRY);
 for(const [id,pack] of Object.entries(s.packs.npcs)){
  if(!/^atlas_npc_[1-9][0-9]{0,5}$/.test(id)||
     !world.living.atlas_npcs?.records[id])throw Error('Orphan atlas resource inventory');
  validPack(pack,MAX_NPC_CARRY);
 }
 for(const [key,node] of Object.entries(s.nodes)){
  const parts=/^(0|[1-9][0-9]{0,3}),(0|[1-9][0-9]{0,3})$/.exec(key);
  if(!parts||!node||Array.isArray(node)||typeof node!=='object'||
    Object.keys(node).sort().join(',')!=='material,ready_at'||
    !Object.hasOwn(RESOURCE,node.material)||
    !Number.isSafeInteger(node.ready_at)||node.ready_at<0)
   throw Error('Invalid depleted atlas resource node');
  GRID.tile(Number(parts[1]),Number(parts[2]));
 }
 return true;
}
function packOf(world,owner){
 const s=world.living.atlas_resources;
 if(owner==='player')return s.packs.player;
 if(!world.living.atlas_npcs?.records[owner])
  throw Error('Unknown atlas resource gatherer');
 return s.packs.npcs[owner]??(s.packs.npcs[owner]={});
}
function inventory(world,owner){
 const s=world?.living?.atlas_resources;
 const pack=owner==='player'?s?.packs?.player:s?.packs?.npcs?.[owner];
 return pack?{...pack}:{};
}
function source(world,owner){
 if(owner==='player'){
  const p=world.characters?.['1']?.atlas_position;
  if(!p)throw Error('Enter the world before gathering');
  return {x:p.x,y:p.y,role:'player'};
 }
 const npc=world.living?.atlas_npcs?.records?.[owner];
 if(!npc)throw Error('Unknown atlas resource gatherer');
 return npc;
}
function harvest(world,owner,x,y){
 ensure(world);GRID.tile(x,y);
 const actor=source(world,owner);
 if(Math.abs(actor.x-x)+Math.abs(actor.y-y)>1)
  throw Error('Resource tile must be adjacent');
 const material=TERRAIN.readTile(world,x,y).material;
 const resource=RESOURCE[material];
 if(!resource)throw Error('No harvestable resource on this terrain');
 if(owner!=='player'&&resource.job!==actor.role)
  throw Error('This NPC cannot gather that resource');
 const pack=packOf(world,owner),cap=owner==='player'?MAX_PLAYER_CARRY:MAX_NPC_CARRY;
 if(Object.values(pack).reduce((total,q)=>total+q,0)>=cap)
  throw Error('Resource pack is full');
 const ledger=world.living.atlas_resources,key=x+','+y,old=ledger.nodes[key];
 if(old&&old.material===material&&old.ready_at>world.living.minute)
  throw Error('Resource patch is recovering');
 if(!old&&Object.keys(ledger.nodes).length>=MAX_NODES){
  for(const [id,node] of Object.entries(ledger.nodes))
   if(node.ready_at<=world.living.minute)delete ledger.nodes[id];
  if(Object.keys(ledger.nodes).length>=MAX_NODES)
   throw Error('Active resource patch limit reached');
 }
 ledger.nodes[key]={material,ready_at:world.living.minute+REGEN_MINUTES};
 pack[resource.item]=(pack[resource.item]||0)+1;
 return {item:resource.item,count:pack[resource.item],x,y,
  replenishes_at:ledger.nodes[key].ready_at,owner};
}
function available(world,x,y,role){
 if(x<0||y<0||x>=GRID.WIDTH||y>=GRID.HEIGHT)return false;
 const material=TERRAIN.readTile(world,x,y).material;
 if(!RESOURCE[material]||RESOURCE[material].job!==role)return false;
 const node=world.living.atlas_resources.nodes[x+','+y];
 return !node||node.material!==material||node.ready_at<=world.living.minute;
}
function advance(world,minute){
 if(minute%WORK_INTERVAL!==0)return 0;
 ensure(world);
 let gathered=0;
 // Sparse landscape is the source of all supplies, not a pretend NPC economy.
 for(const npc of Object.values(world.living.atlas_npcs?.records||{})){
  if(!['forager','worker'].includes(npc.role))continue;
  const pack=packOf(world,npc.id);
  if(Object.values(pack).reduce((s,v)=>s+v,0)>=MAX_NPC_CARRY)continue;
  for(const [dx,dy] of [[0,0],[0,-1],[1,0],[0,1],[-1,0]]){
   const x=npc.x+dx,y=npc.y+dy;
   if(!available(world,x,y,npc.role))continue;
   harvest(world,npc.id,x,y);gathered++;break;
  }
 }
 return gathered;
}
module.exports=Object.freeze({ensure,validate,harvest,advance,inventory,RESOURCE,
 REGEN_MINUTES,WORK_INTERVAL,MAX_PLAYER_CARRY,MAX_NPC_CARRY});
