'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createDKServer}=require('../server/dk-server.cjs');
const {createCharacter,makeWorld,applyCharacterAction}=require('../server/world.cjs');
async function fixture(t){
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-local-m3-'));
 const app=await createDKServer({dataDir,port:0});
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dataDir,{recursive:true,force:true});});
 return {app,dataDir,base:'http://127.0.0.1:'+app.address.port};
}
const post=(base,route,body,headers={})=>fetch(base+route,{
 method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)
});
test('one local Demon Killer game, no password, no external dashboard or exposed files',async t=>{
 const {base}=await fixture(t);
 const homepage=await fetch(base+'/');
 assert.equal(homepage.status,200);
 const html=await homepage.text();
 assert.match(html,/DEMON KILLER/);
 assert.match(html,/dkServerOptions/);
 assert.match(html,/SHUT DOWN SERVER/);
 assert.equal((await fetch(base+'/dk-menu-server.js')).status,200);
 const health=await (await fetch(base+'/api/v1/health')).json();
 assert.equal(health.build,'local-m7');
 assert.equal(health.background_world,true);
 assert.equal((await fetch(base+'/player',{redirect:'manual'})).status,302);
 assert.equal((await fetch(base+'/api/v1/auth/status')).status,404);
 for(const f of ['/server/world.cjs','/server/data/world.json','/.git/config','/docs/world-server-design.md','/assets/../server/world.cjs','/assets/%2e%2e/server/world.cjs'])
   assert.equal((await fetch(base+f)).status,404,f);
 assert.equal((await fetch(base+'/',{headers:{Origin:'http://evil.example'}})).status,403);
 assert.equal((await fetch(base+'/api/v1/characters',{headers:{Origin:'http://evil.example'}})).status,403);
 assert.equal((await fetch(base+'/api/v1/characters',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
});
test('one-letter characters and server-validated actions survive restart',async t=>{
 const {app,base,dataDir}=await fixture(t);
 let response=await post(base,'/api/v1/characters',{slot:1,name:'Z'});
 assert.equal(response.status,201);
 assert.equal((await response.json()).character.name,'Z');
 const action=body=>post(base,'/api/v1/characters/1/actions',body);
 assert.equal((await action({action:'move',direction:'north'})).status,409);
 assert.equal((await action({action:'finish_opening'})).status,200);
 assert.equal((await (await fetch(base+'/api/v1/world')).json()).area.objects.find(o=>o.id==='temple_north_door').open,true);
 response=await action({action:'move',direction:'north'});assert.equal(response.status,200);
 assert.equal((await response.json()).character.y,11);
 assert.equal((await action({action:'move',direction:'north',form:'living'})).status,422);
 assert.equal((await action({action:'move',direction:'up'})).status,422);
 assert.equal((await action({action:'resurrect'})).status,409);
 for(let i=0;i<3;i++)assert.equal((await action({action:'move',direction:'north'})).status,200);
 response=await action({action:'resurrect'});assert.equal(response.status,200);
 assert.equal((await response.json()).character.form,'living');
 assert.equal((await action({action:'resurrect'})).status,409);
 assert.equal((await action({action:'move',direction:'north'})).status,409);
 const disk=JSON.parse(await fs.readFile(path.join(dataDir,'world.json'),'utf8'));
 assert.equal(disk.characters['1'].form,'living');
 assert.equal(disk.characters['1'].crystal_spent,true);
 await app.close();
 const again=await createDKServer({dataDir,port:0});
 t.after(()=>again.server.listening?again.close():Promise.resolve());
 assert.equal(again.world.characters['1'].form,'living');
 assert.equal(again.world.characters['1'].x,8);
 await again.close();
});
test('server controls temple doors, walls and character actions',()=>{
 let world=createCharacter(makeWorld(),1,'A').world;
 world=applyCharacterAction(world,1,{action:'finish_opening'}).world;
 world.characters['1'].x=8;world.characters['1'].y=1;
 world.characters['1'].form='living';world.characters['1'].opening_state='resurrected';world.characters['1'].crystal_spent=true;
 let result=applyCharacterAction(world,1,{action:'toggle_door'});
 assert.equal(result.world.areas['dk.temple.sacrifice.001'].objects.find(o=>o.id==='temple_north_door').open,false);
 assert.throws(()=>applyCharacterAction(result.world,1,{action:'move',direction:'north'}),/closed door/);
 assert.throws(()=>applyCharacterAction(result.world,1,{action:'resurrect',form:'living'}),/Only valid/);
});
test('Options shutdown requires a same-origin browser control request and finishes writes',async t=>{
 const {app,base,dataDir}=await fixture(t);
 assert.equal((await fetch(base+'/api/v1/server/shutdown',{method:'POST'})).status,403);
 assert.equal((await fetch(base+'/api/v1/server/shutdown',{method:'POST',headers:{'X-DK-Control':'shutdown',Origin:'http://evil.example'}})).status,403);
 assert.equal((await fetch(base+'/api/v1/server/shutdown',{method:'POST',headers:{'X-DK-Control':'shutdown','Sec-Fetch-Site':'cross-site'}})).status,403);
 const notified=new Promise(resolve=>app.server.once('dk:shutdown',resolve));
 const response=await fetch(base+'/api/v1/server/shutdown',{method:'POST',headers:{'X-DK-Control':'shutdown'}});
 assert.equal(response.status,202);
 await notified;
 assert.equal(app.server.listening,true,'host process handles shutdown after response');
 await app.close();
 assert.equal(app.server.listening,false);
 assert.ok((await fs.readFile(path.join(dataDir,'world.json'),'utf8')).includes('dk.world.001'));
});
