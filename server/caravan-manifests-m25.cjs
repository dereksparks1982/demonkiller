'use strict';
// M25: bounded, durable manifests for actual merchant shipments.
// Uses only the saved M24 caravan state and never generates goods or coins.
const LIMIT=64;
function ensure(s) {
 if(!s)return false;
 let changed=false;
 if(!Array.isArray(s.manifests)){s.manifests=[];changed=true;}
 if(s.manifest_sequence===undefined){s.manifest_sequence=0;changed=true;}
 if(s.active&&!s.active.manifest_id){
  const id='trip_'+(++s.manifest_sequence),g=s.active;
  g.manifest_id=id;
  s.manifests.push({id,source_id:g.source_id,dest_id:g.dest_id,
   item_type:g.item_type,quantity:g.quantity,started_minute:g.started_minute,
   purchased_minute:g.cargo_serial?g.started_minute:null,ended_minute:null,
   cargo_serial:g.cargo_serial,status:g.cargo_serial?'carrying':'planned',
   reason:null,legacy:true});
  changed=true;
 }
 while(s.manifests.length>LIMIT){s.manifests.shift();changed=true;}
 return changed;
}
function start(s,g){
 if(!Array.isArray(s.manifests)||!Number.isSafeInteger(s.manifest_sequence)||
    g.manifest_id)throw Error('Caravan manifests must be initialized before departure');
 const id='trip_'+(++s.manifest_sequence);
 g.manifest_id=id;
 s.manifests.push({id,source_id:g.source_id,dest_id:g.dest_id,
  item_type:g.item_type,quantity:g.quantity,started_minute:g.started_minute,
  purchased_minute:null,ended_minute:null,cargo_serial:null,status:'planned',reason:null});
 if(s.manifests.length>LIMIT)s.manifests.shift();
 return id;
}
function update(s,g,status,minute,{serial=null,reason=null}={}){
 ensure(s);
 const m=s.manifests.find(x=>x.id===g?.manifest_id);
 if(!m)throw Error('Active caravan has no trade manifest');
 if(status==='carrying'){
  if(m.status!=='planned'||!serial||!/^ent_[1-9][0-9]*$/.test(serial))
   throw Error('Invalid caravan purchase receipt');
  m.status='carrying';m.cargo_serial=serial;m.purchased_minute=minute;
 }else if(status==='delivered'||status==='interrupted'){
  if(!['planned','carrying'].includes(m.status))
   throw Error('Trade manifest has already closed');
  if(status==='delivered'&&m.status!=='carrying')
   throw Error('Cannot deliver unpurchased cargo');
  m.status=status;m.ended_minute=minute;
  m.reason=status==='interrupted'?String(reason||'Unknown interruption').slice(0,200):null;
 }else throw Error('Invalid trade manifest transition');
}
function validate(s){
 if(s.manifests===undefined)return true;
 if(!Array.isArray(s.manifests)||s.manifests.length>LIMIT||
   !Number.isSafeInteger(s.manifest_sequence)||s.manifest_sequence<0)
  throw Error('Invalid trade manifest registry');
 const ids=new Set();
 for(const m of s.manifests){
  if(!m||typeof m.id!=='string'||!/^trip_[1-9][0-9]*$/.test(m.id)||
     ids.has(m.id)||!['planned','carrying','delivered','interrupted'].includes(m.status)||
     typeof m.source_id!=='string'||typeof m.dest_id!=='string'||
     typeof m.item_type!=='string'||!Number.isInteger(m.quantity)||m.quantity<1||m.quantity>64||
     !Number.isSafeInteger(m.started_minute)||m.started_minute<0||
     (m.purchased_minute!==null&&(!Number.isSafeInteger(m.purchased_minute)||
       m.purchased_minute<m.started_minute))||
     (m.ended_minute!==null&&(!Number.isSafeInteger(m.ended_minute)||
       m.ended_minute<m.started_minute))||
     (m.cargo_serial!==null&&(typeof m.cargo_serial!=='string'||
       !/^ent_[1-9][0-9]*$/.test(m.cargo_serial)))||
     (m.status==='planned'&&(m.cargo_serial!==null||m.ended_minute!==null))||
     (m.status==='carrying'&&(!m.cargo_serial||m.ended_minute!==null))||
     (m.status==='delivered'&&(!m.cargo_serial||m.ended_minute===null))||
     (m.status==='interrupted'&&m.ended_minute===null)||
     (m.reason!==null&&(typeof m.reason!=='string'||m.reason.length>200)))
   throw Error('Invalid trade manifest');
  ids.add(m.id);
 }
 const max=Math.max(0,...s.manifests.map(m=>Number(m.id.slice(5))));
 if(s.manifest_sequence<max)throw Error('Trade manifest IDs are not monotonic');
 if(s.active?.manifest_id&&s.manifests.length&&
    !s.manifests.some(x=>x.id===s.active.manifest_id&&
      ['planned','carrying'].includes(x.status)))
  throw Error('Active caravan manifest missing');
 return true;
}
function recent(s){
 return (s?.manifests||[]).filter(x=>['delivered','interrupted'].includes(x.status))
  .slice(-3).reverse().map(x=>({id:x.id,status:x.status,item_type:x.item_type,
   quantity:x.quantity,ended_minute:x.ended_minute}));
}
module.exports={LIMIT,ensure,start,update,validate,recent};
