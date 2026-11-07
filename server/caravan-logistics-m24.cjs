'use strict';
// DK Server M24: physical cross-region merchant cargo.
// RunUO-inspired vendor/mobile trade, authored independently in JavaScript.
const {VILLAGE,COURT}=require('./regions.cjs');
const {location,total,CAPACITY}=require('./vendors-m18.cjs');
const {reconcile,counts}=require('./entity-registry-m10.cjs');
const SOURCE='village_market',DEST='courtyard_market';
const MERCHANT='caravan_trader',ESCORT='caravan_guard',TYPE='produce';
const QTY=2,BUY_PRICE=4,SALE_PRICE=6,LIFETIME=2160,COOLDOWN=180;
function ensure(world){
 if(!world.living)throw Error('Caravan trade requires a world');
 if(world.living.caravans)return false;
 world.living.caravans={schema:1,active:null,purchased:0,delivered:0,
  last_trip_minute:null,profit:0,abandoned:0};
 return true;
}
function dist(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function event(world,minute,type,text,extra,out){
 const living=world.living,e={id:'event_'+(++living.event_sequence),minute,type,text,...extra};
 living.events.push(e);if(living.events.length>512)living.events.shift();
 out.push(e);return e;
}
function safe(world){
 const l=world.living,n=l.npcs[MERCHANT],escort=l.npcs[ESCORT];
 if(!n?.alive||!escort?.alive||l.territories[VILLAGE]?.control!=='settlers'||
    l.territories[COURT]?.control!=='settlers')return false;
 for(const npc of [n,escort]){
  const mode=l.npc_ai?.brains[npc.id]?.mode;
  if(['flee','defend','recover','dead'].includes(mode))return false;
 }
 return true;
}
function packed(world){
 return Object.values(world.entity_registry?.items||{}).filter(item=>
  item.parent==='npc_pack_'+MERCHANT&&item.type===TYPE);
}
function plan(world,minute,out){
 if(minute%60!==0)return;
 ensure(world);
 const s=world.living.caravans;
 if(s.active||!safe(world)||minute<(s.last_trip_minute??-1000)+COOLDOWN)return;
 const l=world.living,n=l.npcs[MERCHANT],escort=l.npcs[ESCORT];
 if(n.area_id!==VILLAGE||escort.area_id!==VILLAGE||dist(n,escort)>10)return;
 const source=l.businesses[SOURCE],dest=l.businesses[DEST];
 if(!source||!dest||source.stock<QTY||n.coins<BUY_PRICE||
    source.coins+BUY_PRICE>1e9||dest.coins<SALE_PRICE||
    total(dest)+QTY>CAPACITY)return;
 const pack='npc_pack_'+MERCHANT,bag=world.entity_registry?.containers?.[pack];
 const load=Object.values(world.entity_registry?.items||{})
  .filter(item=>item.parent===pack).reduce((sum,item)=>sum+item.amount,0);
 if(!bag||load+QTY>bag.capacity)return;
 s.active={merchant_id:MERCHANT,escort_id:ESCORT,phase:'to_source',
  source_id:SOURCE,dest_id:DEST,item_type:TYPE,quantity:QTY,
  started_minute:minute,expires_minute:minute+LIFETIME,cargo_serial:null};
 event(world,minute,'caravan.planned','The wandering merchant prepared a supply caravan.',
  {npc_id:MERCHANT,escort_id:ESCORT,from:SOURCE,to:DEST,area_id:VILLAGE},out);
}
function destination(world,n){
 const g=world.living.caravans?.active;
 if(!g)return null;
 if(n.id===ESCORT){
  const trader=world.living.npcs[MERCHANT];
  return trader?.alive?{area_id:trader.area_id,x:trader.x,y:trader.y}:null;
 }
 if(n.id!==MERCHANT)return null;
 const shop=world.living.businesses[g.phase==='to_source'?SOURCE:DEST];
 if(!shop)return null;
 const point=location(world,shop);
 return {area_id:shop.area_id,x:point.x,y:point.y};
}
function cancel(world,minute,out,reason){
 const s=world.living.caravans,goal=s?.active;
 if(!goal)return;
 s.active=null;s.abandoned++;s.last_trip_minute=minute;
 event(world,minute,'caravan.interrupted','A merchant caravan was interrupted.',
  {reason,area_id:world.living.npcs[MERCHANT]?.area_id||VILLAGE,
    cargo_serial:goal.cargo_serial},out);
 // An acquired item is never deleted. It remains in the trader's inventory
 // (and in the trader's M12 corpse if the merchant was killed).
}
function process(world,minute,out){
 if(minute%5!==0)return;
 ensure(world);
 const s=world.living.caravans,g=s.active;if(!g)return;
 const l=world.living,n=l.npcs[MERCHANT],escort=l.npcs[ESCORT];
 if(!n?.alive||!escort?.alive){cancel(world,minute,out,'The merchant or escort died');return;}
 if(minute>=g.expires_minute){cancel(world,minute,out,'The caravan deadline passed');return;}
 if(!safe(world))return;
 if(n.area_id!==escort.area_id||dist(n,escort)>4)return;
 if(g.phase==='to_source'){
  const shop=l.businesses[SOURCE],spot=location(world,shop);
  if(n.area_id!==shop.area_id||dist(n,spot)>1||!shop.open||
    shop.stock<QTY||n.coins<BUY_PRICE||shop.coins+BUY_PRICE>1e9)return;
  reconcile(world);
  const reg=world.entity_registry,from='vendor_stock_'+SOURCE;
  const item=Object.values(reg.items).find(i=>
    i.parent===from&&i.type===TYPE&&i.amount>=QTY);
  if(!item)return;
  const pack='npc_pack_'+MERCHANT,bag=reg.containers[pack];
  if(!bag)return;
  const current=Object.values(reg.items).filter(i=>i.parent===pack)
    .reduce((sum,i)=>sum+i.amount,0);
  if(current+QTY>bag.capacity)return;
  let serial;
  if(item.amount===QTY){item.parent=pack;serial=item.serial;}
  else{
   item.amount-=QTY;serial='ent_'+reg.next_serial++;
   reg.items[serial]={serial,kind:'item',type:TYPE,amount:QTY,
    parent:pack,created_minute:minute};
  }
  n.coins-=BUY_PRICE;shop.coins+=BUY_PRICE;shop.sales+=QTY;
  shop.stock-=QTY;s.purchased+=QTY;g.cargo_serial=serial;
  g.phase='to_destination';
  reconcile(world);counts(world);
  event(world,minute,'caravan.purchased',
   'The wandering merchant paid for real produce at the Village Market.',
   {npc_id:MERCHANT,from:SOURCE,item_serial:serial,units:QTY,
    gold:BUY_PRICE,area_id:VILLAGE},out);
 }else{
  const shop=l.businesses[DEST],spot=location(world,shop);
  if(n.area_id!==shop.area_id||dist(n,spot)>1||!shop.open||
    shop.coins<SALE_PRICE||n.coins+SALE_PRICE>1e9||
    total(shop)+QTY>CAPACITY)return;
  const reg=world.entity_registry,item=reg.items[g.cargo_serial];
  if(!item||item.parent!=='npc_pack_'+MERCHANT||
     item.type!==TYPE||item.amount!==QTY){cancel(world,minute,out,'Carried goods were lost');return;}
  const vendor='vendor_stock_'+DEST;
  if(!reg.containers[vendor])return;
  item.parent=vendor;
  if(shop.product===TYPE)shop.stock+=QTY;
  else shop.other_stock[TYPE]=(shop.other_stock[TYPE]||0)+QTY;
  shop.coins-=SALE_PRICE;shop.expenses+=SALE_PRICE;
  n.coins+=SALE_PRICE;
  s.delivered+=QTY;s.profit+=SALE_PRICE-BUY_PRICE;
  s.last_trip_minute=minute;s.active=null;
  reconcile(world);counts(world);
  event(world,minute,'caravan.delivered',
   'The wandering merchant supplied the Courtyard Market.',
   {npc_id:MERCHANT,to:DEST,item_serial:item.serial,units:QTY,
    gold:SALE_PRICE,area_id:COURT},out);
 }
}
function validate(world){
 const s=world.living?.caravans;if(!s)return true;
 if(s.schema!==1||!Number.isSafeInteger(s.purchased)||s.purchased<0||
    !Number.isSafeInteger(s.delivered)||s.delivered<0||
    s.delivered>s.purchased||!Number.isSafeInteger(s.profit)||s.profit<0||
    !Number.isSafeInteger(s.abandoned)||s.abandoned<0||
    (s.last_trip_minute!==null&&(!Number.isSafeInteger(s.last_trip_minute)||s.last_trip_minute<0)))
   throw Error('Invalid caravan logistics');
 const g=s.active;
 if(g!==null){
  if(!g||g.merchant_id!==MERCHANT||g.escort_id!==ESCORT||
   !['to_source','to_destination'].includes(g.phase)||
   g.source_id!==SOURCE||g.dest_id!==DEST||g.item_type!==TYPE||
   g.quantity!==QTY||!Number.isSafeInteger(g.started_minute)||
   g.started_minute<0||g.expires_minute!==g.started_minute+LIFETIME||
   (g.phase==='to_source'&&g.cargo_serial!==null)||
   (g.phase==='to_destination'&&
    (typeof g.cargo_serial!=='string'||!/^ent_[1-9][0-9]*$/.test(g.cargo_serial))))
   throw Error('Invalid active caravan journey');
 }
 return true;
}
function listing(world){
 const s=world.living?.caravans,n=world.living?.npcs?.[MERCHANT],p=world.characters?.['1'];
 const nearby=!!(n&&p&&n.area_id===p.area_id&&dist(n,p)<=10);
 return {minute:world.living?.minute||0,revision:world.revision,
  purchased:s?.purchased||0,delivered:s?.delivered||0,
  merchant_profit:s?.profit||0,interrupted:s?.abandoned||0,
  nearby_caravan:nearby&&s?.active?{merchant_name:n.name,phase:s.active.phase,
   goods:s.active.phase==='to_destination'?TYPE:null,
   escort_alive:!!world.living.npcs[ESCORT]?.alive}:null};
}
module.exports={SOURCE,DEST,MERCHANT,ESCORT,QTY,BUY_PRICE,SALE_PRICE,
 ensure,plan,destination,process,validate,listing};
