'use strict';
// M10 spatial-sector index. Derived in memory, never treated as source of truth.
// Sector size follows RunUO's 16-tile idea, with independent JavaScript design.
const SECTOR_SIZE=16;
function key(area,sx,sy){return area+'#'+sx+','+sy;}
function cell(x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0)
    throw Error('Invalid sector coordinates');
  return {sx:Math.floor(x/SECTOR_SIZE),sy:Math.floor(y/SECTOR_SIZE)};
}
function build(world){
  const sectors=new Map(),areas=new Map();
  for(const [id,a] of Object.entries(world.areas||{}))
    areas.set(id,{area_id:id,width:a.width,height:a.height,
      sectors_x:Math.ceil(a.width/SECTOR_SIZE),sectors_y:Math.ceil(a.height/SECTOR_SIZE)});
  function add(record){
    if(!areas.has(record.area_id))return;
    if(!Number.isInteger(record.x)||!Number.isInteger(record.y)||
       record.x<0||record.y<0||record.x>=areas.get(record.area_id).width||
       record.y>=areas.get(record.area_id).height)return;
    const {sx,sy}=cell(record.x,record.y),k=key(record.area_id,sx,sy);
    if(!sectors.has(k))sectors.set(k,[]);
    sectors.get(k).push(record);
  }
  const refs=world.entity_registry?.refs||{},serialFor=k=>refs[k]?.serial||null;
  for(const [slot,c] of Object.entries(world.characters||{}))
    add({kind:'character',id:'player:'+slot,serial:serialFor('player:'+slot),
      area_id:c.area_id,x:c.x??8,y:c.y??12});
  for(const n of Object.values(world.living?.npcs||{}))if(n.alive)
    add({kind:'npc',id:n.id,serial:serialFor('npc:'+n.id),name:n.name,
      area_id:n.area_id,x:n.x,y:n.y});
  for(const n of Object.values(world.living?.combat?.creatures||{}))if(n.alive)
    add({kind:'monster',id:n.id,serial:serialFor('monster:'+n.id),
      area_id:n.area_id,x:n.x,y:n.y,health:n.health});
  for(const [area_id,a] of Object.entries(world.areas||{}))
    for(const o of a.objects||[])add({kind:'fixture',id:o.id,
      serial:serialFor('fixture:'+area_id+':'+o.id),type:o.type,
      area_id,x:o.x,y:o.y});
  for(const drop of Object.values(world.living?.storage?.ground||{}))
    add({kind:'ground_item',id:drop.id,serial:serialFor('ground:'+drop.id),
      area_id:drop.area_id,x:drop.x,y:drop.y,
      type:drop.item,quantity:drop.quantity});
  for(const corpse of Object.values(world.living?.mobile_assets?.corpses||{}))
    add({kind:'corpse',id:corpse.id,serial:serialFor('corpse:'+corpse.id),
      name:corpse.name,area_id:corpse.area_id,x:corpse.x,y:corpse.y});
  for(const drop of Object.values(world.living?.combat?.drops||{}))
    add({kind:'monster_loot',id:drop.id,serial:null,
      area_id:drop.area_id,x:drop.x,y:drop.y,type:drop.item});
  for(const chest of Object.values(world.entity_registry?.containers||{}))
    if(chest.kind==='chest')
      add({kind:'chest',id:chest.id,serial:null,
        area_id:chest.area_id,x:chest.x,y:chest.y});
  for(const group of sectors.values())
    group.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  return {sectors,areas,world_revision:world.revision};
}
function lookup(index,area_id,x,y,radius=8){
  const a=index.areas.get(area_id);
  if(!a)throw Error('Unknown region for spatial query');
  if(!Number.isSafeInteger(radius)||radius<0||radius>32)
    throw Error('Invalid nearby radius');
  if(!Number.isInteger(x)||!Number.isInteger(y)||
      x<0||y<0||x>=a.width||y>=a.height)
    throw Error('Invalid nearby position');
  const xmin=Math.max(0,x-radius),xmax=Math.min(a.width-1,x+radius);
  const ymin=Math.max(0,y-radius),ymax=Math.min(a.height-1,y+radius);
  const a0=cell(xmin,ymin),a1=cell(xmax,ymax),entities=[];
  for(let sy=a0.sy;sy<=a1.sy;sy++)for(let sx=a0.sx;sx<=a1.sx;sx++){
    for(const obj of index.sectors.get(key(area_id,sx,sy))||[]){
      if(Math.abs(obj.x-x)+Math.abs(obj.y-y)<=radius)entities.push({...obj});
    }
  }
  entities.sort((a,b)=>
    (Math.abs(a.x-x)+Math.abs(a.y-y))-(Math.abs(b.x-x)+Math.abs(b.y-y))||
    a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  return {area_id,origin:{x,y},radius,sector:{...cell(x,y)},
    sectors_x:a.sectors_x,sectors_y:a.sectors_y,entities};
}
module.exports={SECTOR_SIZE,cell,build,lookup};
