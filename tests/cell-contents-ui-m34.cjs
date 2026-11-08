'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const CLIENT=require('../streaming-cell-contents-m34.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function delta({...data}={}){
 return {schema:1,area_id:'dk.village.001',origin:{x:54,y:103},
  cursor:'0123456789abcdef0123456789abcdef',world_revision:10,
  reset:true,cell_upsert:[{id:'dk.cell.village',kind:'region',lod:'active'}],
  cell_removed:[],upsert:[{kind:'npc',id:'baker',area_id:'dk.village.001',
   cell_id:'dk.cell.village',x:55,y:103,alive:true}],
  removed:[],...data};
}
test('M34 client materializes, updates and evicts authoritative world objects',()=>{
 const client=CLIENT.create();
 const first=client.apply(delta());
 assert.equal(first.entity_count,1);
 assert.equal(client.visible('npc',{area_id:'dk.village.001',x:54,y:103}).length,1);
 const second=client.apply(delta({reset:false,upsert:[{
  kind:'npc',id:'baker',area_id:'dk.village.001',
  cell_id:'dk.cell.village',x:56,y:103,alive:true
 }]}));
 assert.equal(second.entity_count,1);
 assert.equal(client.visible('npc',{area_id:'dk.village.001',x:54,y:103})[0].x,56);
 client.apply(delta({reset:false,upsert:[],removed:['npc:baker'],cell_removed:['dk.cell.village']}));
 assert.equal(client.visible('npc',{area_id:'dk.village.001',x:54,y:103}).length,0);
 assert.equal(client.stats().cell_count,0);
 client.reset();assert.equal(client.stats().entity_count,0);
});
test('M34 client rejects corrupt content batches atomically and does not mix different areas',()=>{
 const client=CLIENT.create();client.apply(delta());
 const previous=client.stats();
 assert.throws(()=>client.apply(delta({reset:false,upsert:[{kind:'npc',id:'fake'}]})),
  /Invalid Streaming Cell entity/);
 assert.deepEqual(client.stats(),previous,'invalid batch must not partially apply removals');
 assert.throws(()=>client.apply(delta({reset:false,area_id:'dk.temple.sacrifice.001'})),
  /another area/);
 assert.equal(client.visible('npc',{area_id:'dk.temple.sacrifice.001',x:54,y:103}),null);
 assert.equal(client.visible('npc',{area_id:'dk.village.001',x:100,y:100}),null);
 assert.equal(client.stats().area_id,'dk.village.001');
});
test('M34 live door presentation keeps only server-provided open/locked flags',()=>{
 const client=CLIENT.create();
 client.apply(delta({upsert:[{
  kind:'fixture',id:'courtyard_temple_door',area_id:'dk.village.001',
  cell_id:'dk.cell.village',type:'door',x:18,y:103,open:true,locked:false
 }]}));
 assert.equal(client.fixtures()[0].open,true);
 assert.equal(client.fixtures()[0].locked,false);
 assert.equal(client.stats().entity_count,1);
});
test('M34 renderer uses Streaming Cell contents before sector fallback without changing movement',()=>{
 const js=read('outdoor.js'),html=read('outdoor.html'),api=read('dk-menu-server.js');
 assert(html.indexOf('streaming-cell-contents-m34.js')>0);
 assert(html.indexOf('streaming-cell-contents-m34.js')<html.indexOf('outdoor.js?v='));
 assert.match(js,/async function refreshCellContents\(\)/);
 assert.match(js,/cellContents\.apply\(snapshot\)/);
 assert.match(js,/const materialized=cellContents\?\.visible\(kind,player,12\)/);
 assert.match(js,/const view=sectorView/);
 assert.match(js,/advanceVisual\(dt\)/);
 assert.match(js,/pointerMove\(dt\)/);
 assert.match(js,/rightHeld/);
 assert.match(html,/key==='p'\|\|key==='i'/);
 for(const id of ['openPaperDoll','openBackpack','contentsDebugButton'])
  assert(!html.includes('id="'+id+'"'));
 assert.match(api,/async cellContents\(cursor=null,radius=24\)/);
 assert.match(read('server/local-game.cjs'),/'streaming-cell-contents-m34\.js'/);
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'outdoor.js'}));
 assert.doesNotThrow(()=>new vm.Script(read('streaming-cell-contents-m34.js')));
});
