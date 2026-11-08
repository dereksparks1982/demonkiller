'use strict';
// DK Server M18: independently implemented physical vendor inventories.
// RunUO BaseVendor/SBInfo inspired; no third-party GPL implementation copied.
const {COURT,VILLAGE}=require('./regions.cjs');
const GOODS=new Set(['herbs','wood','ore','bread','tools','produce','meals',
 'torches','rations','bandages','grain','grist','flour',
 'raw_meat','hides','spider_silk','venom']);
const CAPACITY=500,MAX_VENDORS=32;
function inventoryId(shop){return 'vendor_stock_'+shop.id;}
function location(world,shop){
 const o=world.areas[shop.area_id]?.objects.find(obj=>obj.id===shop.id);
 if(!o)throw Error('Shop is missing its physical storefront');
 return {x:o.door?.x??o.x,y:o.door?o.door.y+1:o.y};
}
function merchandises(shop){return GOODS.has(shop.product);}
function ensure(world){
 if(!world.living||!world.entity_registry)throw Error('Vendor stock requires living world');
 let changed=false;
 for(const shop of Object.values(world.living.businesses)){
  if(!merchandises(shop))continue; // Bank is a financial service, not a commodity.
  if(!shop.other_stock){shop.other_stock={};changed=true;}
  const id=inventoryId(shop),pos=location(world,shop);
  if(!world.entity_registry.containers[id]){
   world.entity_registry.containers[id]={
    id,kind:'vendor_stock',owner:'business:'+shop.id,
    area_id:shop.area_id,x:pos.x,y:pos.y,capacity:CAPACITY
   };
   changed=true;
  }
 }
 return changed;
}
function total(shop){
 return shop.stock+Object.values(shop.other_stock||{}).reduce((sum,n)=>sum+n,0);
}
function canAccept(shop,item,qty){
 if(!GOODS.has(item)||!Number.isInteger(qty)||qty<1||qty>10)return false;
 return total(shop)+qty<=CAPACITY;
}
function validate(world){
 const vendors=Object.values(world.living?.businesses||{}).filter(merchandises);
 if(vendors.length>MAX_VENDORS)throw Error('Too many vendor inventories');
 for(const shop of vendors){
  const id=inventoryId(shop),c=world.entity_registry?.containers[id];
  // Legacy M17 worlds migrate at startup.
  if(shop.other_stock===undefined&&!c)continue;
  if(!shop.other_stock||typeof shop.other_stock!=='object'||
    Array.isArray(shop.other_stock)||!c||c.kind!=='vendor_stock'||
    c.area_id!==shop.area_id||c.owner!=='business:'+shop.id||
    c.capacity!==CAPACITY||!Number.isSafeInteger(shop.stock)||
    shop.stock<0||shop.stock>CAPACITY)
   throw Error('Invalid physical vendor inventory');
  const pos=location(world,shop);
  if(c.x!==pos.x||c.y!==pos.y)throw Error('Vendor stock moved from storefront');
  for(const [type,amount] of Object.entries(shop.other_stock)){
   if(type===shop.product||!GOODS.has(type)||!Number.isSafeInteger(amount)||
      amount<0||amount>CAPACITY)
    throw Error('Invalid vendor commodity balance');
  }
  if(total(shop)>CAPACITY)throw Error('Vendor stock exceeds capacity');
 }
 return true;
}
function listing(world){
 const c=world.characters?.['1'];
 const shops=Object.values(world.living?.businesses||{}).filter(merchandises);
 return {revision:world.revision,world_minute:world.living?.minute||0,
  nearby:c?shops.filter(shop=>{
   const pos=location(world,shop);
   return shop.area_id===c.area_id&&Math.abs(c.x-pos.x)+Math.abs(c.y-pos.y)<=6;
  }).map(shop=>{
   const pos=location(world,shop);
   return {id:shop.id,name:shop.name,open:shop.open,area_id:shop.area_id,
    x:pos.x,y:pos.y,product:shop.product,quantity:shop.stock,
    other_stock:{...(shop.other_stock||{})},total:total(shop),
    vendor_container_id:inventoryId(shop)};
  }):[],count:shops.length};
}
module.exports={GOODS,CAPACITY,ensure,total,canAccept,validate,listing,inventoryId,location,merchandises};
