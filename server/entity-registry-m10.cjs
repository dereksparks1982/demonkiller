'use strict';
// M10: stable RunUO-inspired identities, independently implemented (no GPL code).
// Legacy M9 counts remain public compatibility views while item serials survive
// moves between pack, equipment, bank, ground, and one village chest.
const {COURT,VILLAGE,traversable}=require('./regions.cjs');
const ITEM_TYPES=Object.freeze(['herbs','wood','ore','bread','tools','produce','meals',
  'torches','rations','bandages']);
const KNOWN=new Set(ITEM_TYPES),PACK='pack_1',VAULT='vault_1',
  HAND='hand_1',LIGHT='light_1',CHEST='chest_village_1';
const LIMIT=8192,REF_LIMIT=16384,GROUND_LIMIT=1024;
function allocate(registry){
  if(!Number.isSafeInteger(registry.next_serial)||registry.next_serial<1)
    throw Error('Invalid entity serial counter');
  return 'ent_'+registry.next_serial++;
}
function base(){
  return {schema:1,next_serial:1,items:{},refs:{},containers:{
    [PACK]:{id:PACK,kind:'pack',owner:'1',capacity:200},
    [VAULT]:{id:VAULT,kind:'bank',owner:'1',capacity:500},
    [HAND]:{id:HAND,kind:'equip',slot:'hand',owner:'1',capacity:1},
    [LIGHT]:{id:LIGHT,kind:'equip',slot:'light',owner:'1',capacity:1},
    [CHEST]:{id:CHEST,kind:'chest',area_id:VILLAGE,x:54,y:105,capacity:64,owner:'1'}
  }};
}
function refTargets(world){
  const targets=[];
  for(const [slot,c] of Object.entries(world.characters||{}))
    targets.push(['player:'+slot,'character',c.area_id]);
  for(const n of Object.values(world.living?.npcs||{}))
    targets.push(['npc:'+n.id,'mobile',n.area_id]);
  for(const n of Object.values(world.living?.combat?.creatures||{}))
    targets.push(['monster:'+n.id,'monster',n.area_id]);
  for(const [area_id,area] of Object.entries(world.areas||{}))
    for(const o of area.objects||[])
      targets.push(['fixture:'+area_id+':'+o.id,'fixture',area_id]);
  for(const drop of Object.values(world.living?.storage?.ground||{}))
    targets.push(['ground:'+drop.id,'ground',drop.area_id]);
  for(const corpse of Object.values(world.living?.mobile_assets?.corpses||{}))
    targets.push(['corpse:'+corpse.id,'corpse',corpse.area_id]);
  return targets.sort((a,b)=>a[0].localeCompare(b[0]));
}
function targets(world,registry){
  const want=new Map(),add=(parent,type,amount)=>{
    if(!KNOWN.has(type)||!Number.isSafeInteger(amount)||amount<0)
      throw Error('Invalid legacy inventory during migration');
    if(amount)want.set(parent+'|'+type,amount);
  };
  const player=world.characters?.['1'];
  if(player){
    for(const [type,amount] of Object.entries(player.inventory||{}))
      add(PACK,type,amount);
    if(player.crafting?.hand)add(HAND,player.crafting.hand,1);
    if(player.crafting?.light)add(LIGHT,player.crafting.light,1);
  }
  for(const [type,amount] of Object.entries(world.living?.storage?.vaults?.['1']||{}))
    add(VAULT,type,amount);
  for(const shop of Object.values(world.living?.businesses||{})){
    const vendor='vendor_stock_'+shop.id;
    if(registry.containers[vendor]?.kind!=='vendor_stock')continue;
    add(vendor,shop.product,shop.stock);
    for(const [type,amount] of Object.entries(shop.other_stock||{}))
      add(vendor,type,amount);
  }
  for(const d of Object.values(world.living?.storage?.ground||{}))
    add(d.id,d.item,d.quantity);
  // NPC backpacks and house stores have no M9 count mirror; serials are canonical.
  for(const item of Object.values(registry.items))
    if(item.parent===CHEST||['npc_pack','house_store'].includes(
      registry.containers[item.parent]?.kind))
      want.set(item.parent+'|'+item.type,
        (want.get(item.parent+'|'+item.type)||0)+item.amount);
  return want;
}
function reconcile(world){
  if(!world.living)throw Error('A living world is required for entity registry');
  let changed=false;
  if(!world.entity_registry){world.entity_registry=base();changed=true;}
  const r=world.entity_registry;
  if(r.schema!==1||!r.items||!r.refs||!r.containers)
    throw Error('Unsupported entity registry schema');
  const present=new Set();
  for(const [key,kind,area_id] of refTargets(world)){
    present.add(key);
    if(!r.refs[key]){
      r.refs[key]={serial:allocate(r),kind,area_id,active:true};
      changed=true;
    }else{
      const ref=r.refs[key];
      if(ref.kind!==kind)throw Error('Entity reference changed type');
      if(ref.area_id!==area_id||!ref.active){ref.area_id=area_id;ref.active=true;changed=true;}
    }
  }
  for(const [key,ref] of Object.entries(r.refs)){
    if(!present.has(key)&&ref.active){ref.active=false;changed=true;}
  }
  // Retired transient monsters are known through immutable event history, so
  // their live registry tombstones can eventually be pruned when very numerous.
  const obsolete=Object.keys(r.refs).filter(k=>k.startsWith('monster:')&&!r.refs[k].active);
  if(obsolete.length>1024){
    obsolete.sort((a,b)=>Number(r.refs[a].serial.slice(4))-Number(r.refs[b].serial.slice(4)));
    for(const k of obsolete.slice(0,obsolete.length-1024)){delete r.refs[k];changed=true;}
  }
  const want=targets(world,r),have=new Map();
  for(const item of Object.values(r.items)){
    const k=item.parent+'|'+item.type;
    have.set(k,(have.get(k)||0)+item.amount);
  }
  const surplus=[],deficit=[];
  for(const k of new Set([...want.keys(),...have.keys()])){
    const diff=(want.get(k)||0)-(have.get(k)||0);
    if(diff>0)deficit.push({key:k,remaining:diff,type:k.slice(k.lastIndexOf('|')+1),parent:k.slice(0,k.lastIndexOf('|'))});
    if(diff<0)surplus.push({key:k,remaining:-diff,type:k.slice(k.lastIndexOf('|')+1),parent:k.slice(0,k.lastIndexOf('|'))});
  }
  surplus.sort((a,b)=>a.key.localeCompare(b.key));
  deficit.sort((a,b)=>a.key.localeCompare(b.key));
  for(const dest of deficit){
    for(const src of surplus){
      if(!dest.remaining||src.type!==dest.type||!src.remaining)continue;
      for(const item of Object.values(r.items).sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4)))){
        if(!src.remaining||!dest.remaining)break;
        if(item.parent!==src.parent||item.type!==src.type)continue;
        const count=Math.min(src.remaining,dest.remaining,item.amount);
        if(count===item.amount)item.parent=dest.parent;
        else{
          item.amount-=count;
          const serial=allocate(r);
          r.items[serial]={serial,kind:'item',type:item.type,amount:count,
            parent:dest.parent,created_minute:world.living.minute};
        }
        src.remaining-=count;dest.remaining-=count;changed=true;
      }
    }
    if(dest.remaining){
      const serial=allocate(r);
      r.items[serial]={serial,kind:'item',type:dest.type,amount:dest.remaining,
        parent:dest.parent,created_minute:world.living.minute};
      dest.remaining=0;changed=true;
    }
  }
  for(const src of surplus){
    if(!src.remaining)continue;
    for(const item of Object.values(r.items).sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4)))){
      if(!src.remaining)break;
      if(item.parent!==src.parent||item.type!==src.type)continue;
      const take=Math.min(src.remaining,item.amount);
      item.amount-=take;src.remaining-=take;changed=true;
      if(item.amount===0)delete r.items[item.serial];
    }
    if(src.remaining)throw Error('Entity reconciliation failed');
  }
  validate(world);
  return changed;
}
function counts(world){
  const want=targets(world,world.entity_registry),actual=new Map();
  for(const item of Object.values(world.entity_registry.items)){
    const k=item.parent+'|'+item.type;actual.set(k,(actual.get(k)||0)+item.amount);
  }
  if(want.size!==actual.size||[...want].some(([k,n])=>actual.get(k)!==n))
    throw Error('Entity counts do not agree with the world');
  return true;
}
function validate(world){
  const r=world.entity_registry;
  if(!r)return true; // M9 worlds are migrated at startup.
  if(r.schema!==1||!Number.isSafeInteger(r.next_serial)||r.next_serial<1||
    !r.items||!r.refs||!r.containers||Array.isArray(r.items)||
    Object.keys(r.items).length>LIMIT||Object.keys(r.refs).length>REF_LIMIT)
    throw Error('Invalid entity registry');
  let highest=0;const serials=new Set(),byParent={};
  const verifySerial=s=>{
    if(typeof s!=='string'||!/^ent_[1-9][0-9]*$/.test(s)||serials.has(s))
      throw Error('Invalid or reused world serial');
    const n=Number(s.slice(4));if(!Number.isSafeInteger(n))throw Error('Serial overflow');
    serials.add(s);highest=Math.max(highest,n);
  };
  for(const [key,ref] of Object.entries(r.refs)){
    if(typeof key!=='string'||!ref||!['character','mobile','monster','fixture','ground','corpse'].includes(ref.kind)||
      !world.areas?.[ref.area_id]||typeof ref.active!=='boolean')
      throw Error('Invalid entity reference');
    verifySerial(ref.serial);
  }
  for(const [id,item] of Object.entries(r.items)){
    if(!item||id!==item.serial||item.kind!=='item'||!KNOWN.has(item.type)||
      !Number.isSafeInteger(item.amount)||item.amount<1||item.amount>500||
      !Number.isSafeInteger(item.created_minute)||item.created_minute<0)
      throw Error('Invalid item entity');
    verifySerial(id);
    if(!Object.hasOwn(r.containers,item.parent)){
      if(!/^ground_[1-9][0-9]*$/.test(item.parent)||
        !world.living?.storage?.ground?.[item.parent])
        throw Error('Orphaned entity item');
    }
    byParent[item.parent]=(byParent[item.parent]||0)+item.amount;
  }
  for(const [id,c] of Object.entries(r.containers)){
    if(!c||c.id!==id||!['pack','bank','equip','chest','npc_pack','house_store','vendor_stock'].includes(c.kind)||
      !Number.isInteger(c.capacity)||c.capacity<1||c.capacity>500||
      (['chest','house_store','vendor_stock'].includes(c.kind)&&(!world.areas?.[c.area_id]||
        !Number.isInteger(c.x)||!Number.isInteger(c.y)||
        c.x<0||c.y<0||c.x>=world.areas[c.area_id].width||
        c.y>=world.areas[c.area_id].height)))
      throw Error('Invalid world container');
    if((byParent[id]||0)>c.capacity)throw Error('Entity container capacity exceeded');
  }
  if((byParent[HAND]||0)>1||(byParent[LIGHT]||0)>1)
    throw Error('Invalid equipped stack');
  if(r.next_serial<=highest)throw Error('Entity serial counter has gone backwards');
  return true;
}
function near(c,x,y,r=2){return Math.abs(c.x-x)+Math.abs(c.y-y)<=r;}
function bankAllowed(world,c){
  if(c.area_id!==VILLAGE||!near(c,54,103,3))
    throw Error('Visit the Village Bank to access stored items');
  if(!world.living.businesses.village_bank?.open)throw Error('The bank is closed');
}
function chestAllowed(world,c){
  const chest=world.entity_registry.containers[CHEST];
  if(!chest||chest.area_id!==c.area_id||!near(c,chest.x,chest.y,2))
    throw Error('Move beside the village chest');
}
function homeAllowed(world,c,id){
  const home=Object.values(world.living.housing?.records||{})
    .find(h=>h.storage_id===id);
  if(!home||home.owner?.kind!=='player'||home.owner.slot!==1||
     c.area_id!==home.area_id||!near(c,home.door_x,home.door_y,2))
    throw Error('Your secure house storage is locked or out of reach');
}
function inspect(world){
  const r=world.entity_registry,c=world.characters['1'];
  if(!r||!c)return {items:[],containers:[],revision:world.revision};
  const allowed=new Set([PACK,HAND,LIGHT]);
  if(c.form==='living'){
    if(c.area_id===VILLAGE){
      if(near(c,54,103,3)&&world.living.businesses.village_bank?.open)allowed.add(VAULT);
      try{chestAllowed(world,c);allowed.add(CHEST);}catch(_){}
    }
    for(const home of Object.values(world.living.housing?.records||{}))
      try{homeAllowed(world,c,home.storage_id);allowed.add(home.storage_id);}catch(_){}
  }
  return {items:Object.values(r.items).filter(i=>allowed.has(i.parent))
    .map(i=>({...i})).sort((a,b)=>Number(a.serial.slice(4))-Number(b.serial.slice(4))),
    containers:[...allowed].map(k=>({...r.containers[k]})),revision:world.revision};
}
function transfer(world,command,{maxQuantity=20}={}){
  // The public move_item action retains its 20-unit limit. Internal
  // whole-stack transfers may request up to a validated 500-unit entity.
  if(!command||typeof command!=='object'||Array.isArray(command)||
    Object.keys(command).sort().join(',')!=='action,destination,quantity,serial'||
    command.action!=='move_item'||typeof command.serial!=='string'||
    !/^ent_[1-9][0-9]*$/.test(command.serial))
    throw Error('Invalid item transfer');
  const qty=command.quantity;
  if(!Number.isSafeInteger(maxQuantity)||maxQuantity<1||maxQuantity>500||
    !Number.isSafeInteger(qty)||qty<1||qty>maxQuantity)
    throw Error('Invalid transfer quantity');
  if(![PACK,VAULT,HAND,LIGHT,CHEST,'ground'].includes(command.destination)&&
     world.entity_registry?.containers?.[command.destination]?.kind!=='house_store')
    throw Error('Invalid destination container');
  if(!world.runtime?.running)throw Error('World is paused');
  const next=structuredClone(world);reconcile(next);
  const c=next.characters?.['1'];
  if(!c)throw Error('No character exists');
  if(c.form!=='living')throw Error('Ghosts cannot move physical items');
  if(c.crafting?.incapacitated)throw Error('You are unconscious');
  const r=next.entity_registry,item=r.items[command.serial];
  if(!item||item.amount<qty)throw Error('The item is not in your possession');
  const src=item.parent,destination=command.destination;
  if(src===destination)throw Error('The item is already in that container');
  const sourceDrop=next.living.storage.ground[src];
  if(src===VAULT||destination===VAULT)bankAllowed(next,c);
  if(src===CHEST||destination===CHEST)chestAllowed(next,c);
  const srcHome=r.containers[src]?.kind==='house_store';
  const dstHome=r.containers[destination]?.kind==='house_store';
  if(srcHome)homeAllowed(next,c,src);
  if(dstHome)homeAllowed(next,c,destination);
  if(sourceDrop&&(sourceDrop.area_id!==c.area_id||!near(c,sourceDrop.x,sourceDrop.y,1)))
    throw Error('Move beside the ground item');
  if(![PACK,VAULT,HAND,LIGHT,CHEST].includes(src)&&!srcHome&&!sourceDrop)
    throw Error('The item cannot be moved from that container');
  if(destination==='ground'&&(![COURT,VILLAGE].includes(c.area_id)||
     !traversable(next.areas[c.area_id],c.x,c.y,'living')))
    throw Error('Find an open outdoor tile to drop items');
  const type=item.type;
  const packCount=()=>Object.values(c.inventory).reduce((a,b)=>a+b,0);
  const vault=next.living.storage.vaults['1'];
  if(destination===PACK&&((c.inventory[type]||0)+qty>200||packCount()+qty>200))
    throw Error('Your pack is full');
  if(destination===VAULT&&
     (Object.values(vault).reduce((a,b)=>a+b,0)+qty>500||vault[type]+qty>500))
    throw Error('Your bank vault is full');
  if(destination===CHEST&&
    Object.values(r.items).filter(i=>i.parent===CHEST).reduce((sum,i)=>sum+i.amount,0)+qty>r.containers[CHEST].capacity)
    throw Error('The chest is full');
  if(dstHome&&Object.values(r.items).filter(i=>i.parent===destination)
      .reduce((sum,i)=>sum+i.amount,0)+qty>r.containers[destination].capacity)
    throw Error('House storage is full');
  if(destination===HAND&&(type!=='tools'||qty!==1||c.crafting.hand))
    throw Error('You cannot equip that item in your hand');
  if(destination===LIGHT&&(type!=='torches'||qty!==1||c.crafting.light))
    throw Error('You cannot equip that item as a light');
  if(destination==='ground'&&Object.keys(next.living.storage.ground).length>=GROUND_LIMIT)
    throw Error('The ground is full of items');
  function adjust(parent,amount){
    if(parent===PACK)c.inventory[type]+=amount;
    else if(parent===VAULT)vault[type]+=amount;
    else if(parent===HAND){
      if(amount===-1)c.crafting.hand=null;
      else c.crafting.hand=type;
    }else if(parent===LIGHT){
      if(amount===-1){c.crafting.light=null;c.crafting.torch_until_minute=-1;}
      else{c.crafting.light=type;c.crafting.torch_until_minute=next.living.minute+90;}
    }else if(next.living.storage.ground[parent]){
      const drop=next.living.storage.ground[parent];
      drop.quantity+=amount;
      if(drop.quantity===0)delete next.living.storage.ground[parent];
    }
  }
  adjust(src,-qty);
  let dest=destination;
  if(destination==='ground'){
    dest='ground_'+(++next.living.storage.sequence);
    next.living.storage.ground[dest]={id:dest,area_id:c.area_id,x:c.x,y:c.y,
      item:type,quantity:0,dropped_minute:next.living.minute,
      expires_minute:next.living.minute+360};
  }
  adjust(dest,qty);
  let moved;
  if(item.amount===qty){item.parent=dest;moved=item.serial;}
  else{
    item.amount-=qty;moved=allocate(r);
    r.items[moved]={serial:moved,kind:'item',type,amount:qty,parent:dest,
      created_minute:next.living.minute};
  }
  reconcile(next);counts(next);
  c.revision++;next.revision++;
  const l=next.living,e={id:'event_'+(++l.event_sequence),minute:l.minute,
    type:'item.moved',text:'A persistent item changed containers.',
    item_serial:moved,from:src,to:dest,quantity:qty,area_id:c.area_id};
  l.events.push(e);if(l.events.length>512)l.events.shift();
  validate(next);
  return {world:next,character:c,event:e,item:r.items[moved]};
}
module.exports={PACK,VAULT,HAND,LIGHT,CHEST,ITEM_TYPES,reconcile,validate,
  counts,inspect,transfer,base};
