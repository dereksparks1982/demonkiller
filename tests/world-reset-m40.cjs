'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,7,17);

test('M40 reset is typed, guarded, versioned, persistent, and removes the old world',async t=>{
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m40-reset-'));
 t.after(()=>fs.rm(dataDir,{recursive:true,force:true}));
 let instance=await createDKServer({dataDir,port:0,now:()=>NOW,tickMs:6000});
 t.after(async()=>{if(instance?.server?.listening)await instance.close();});
 let base='http://127.0.0.1:'+instance.address.port;
 const read=route=>fetch(base+route).then(r=>r.json());
 const send=(route,body,extra={})=>fetch(base+route,{
  method:'POST',headers:{'Content-Type':'application/json',...extra},
  body:JSON.stringify(body)
 });
 let response=await send('/api/v1/characters',{slot:1,name:'TEST'});
 assert.equal(response.status,201,JSON.stringify(await response.json()));
 const before=await read('/api/v1/world');
 assert(before.revision>0);
 const body={confirm:'RESET WORLD',expected_revision:before.revision};
 response=await send('/api/v1/save/reset-world',body);
 assert.equal(response.status,403,'Missing owner-control header cannot reset world');
 response=await send('/api/v1/save/reset-world',{...body,confirm:'WRONG'},
  {'X-DK-Control':'reset-world'});
 assert.equal(response.status,422,'A mistyped confirmation is rejected');
 response=await send('/api/v1/save/reset-world',body,{'X-DK-Control':'reset-world'});
 const receipt=await response.json();
 assert.equal(response.status,200,JSON.stringify(receipt));
 assert.equal(receipt.reset,true);
 assert.equal(receipt.characters_deleted,true);
 assert.equal(receipt.world_revision,0);
 assert.deepEqual(Object.keys(instance.world.characters),[]);
 assert.equal(instance.world.revision,0);
 assert.equal(instance.world.living.minute,0);
 const status=await read('/api/v1/save/status');
 assert(status.primary.valid);
 assert.equal(status.primary.revision,0);
 assert(status.backup_count>=1);
 assert(status.backups.every(b=>b.revision===0));
 await assert.rejects(fs.stat(path.join(dataDir,'world-events.ndjson')),{code:'ENOENT'});
 response=await send('/api/v1/save/reset-world',body,{'X-DK-Control':'reset-world'});
 assert.equal(response.status,409,'Old revision cannot reset a newer world');
 await instance.close();instance=null;
 instance=await createDKServer({dataDir,port:0,now:()=>NOW,tickMs:6000});
 base='http://127.0.0.1:'+instance.address.port;
 assert.deepEqual(Object.keys(instance.world.characters),[]);
 assert.equal(instance.world.living.minute,0);
});

test('M40 deleting only the character retains the running persistent world',async t=>{
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m40-delete-'));
 t.after(()=>fs.rm(dataDir,{recursive:true,force:true}));
 const instance=await createDKServer({dataDir,port:0,now:()=>NOW,tickMs:6000});
 t.after(()=>instance.close());
 const base='http://127.0.0.1:'+instance.address.port;
 let res=await fetch(base+'/api/v1/characters',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({slot:1,name:'MILLER'})});
 assert.equal(res.status,201,JSON.stringify(await res.json()));
 const before=instance.world,revision=before.revision;
 res=await fetch(base+'/api/v1/characters/1',{method:'DELETE',
  headers:{'Content-Type':'application/json','X-DK-Control':'delete-character'},
  body:JSON.stringify({name:'MILLER',confirm:'DELETE'})});
 assert.equal(res.status,200,JSON.stringify(await res.json()));
 assert.equal(instance.world.characters['1'],undefined);
 assert(instance.world.revision>revision);
 assert.equal(instance.world.created_at_utc,before.created_at_utc);
 assert.equal(instance.world.areas['dk.village.001'].width,128);
});
