'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const W=require('../server/world.cjs');
const {strategy,readCheckpoints,digest}=require('../server/save-strategy-m13.cjs');
const {loadWorld,createDKServer}=require('../server/dk-server.cjs');
const NOW=Date.UTC(2026,10,6);
async function setup(t,options={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m13-saves-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const durableWrite=async(file,data,{create=false}={})=>{
   await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
   const tmp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
   await fs.writeFile(tmp,data,{flag:'wx',mode:0o600});
   try{
     if(create){
       try{await fs.link(tmp,file);}catch(e){if(e.code!=='EEXIST')throw e;}
     }else await fs.rename(tmp,file);
   }finally{await fs.rm(tmp,{force:true});}
 };
 const snapshots=strategy({dataDir:dir,validateWorld:W.validateWorld,
   durableWrite,now:()=>NOW,...options});
 await snapshots.init();
 return {dir,snapshots,durableWrite};
}
test('M13 makes a validated atomic primary save with a SHA-256 verified checkpoint',async t=>{
 const {dir,snapshots}=await setup(t);
 const world=W.makeWorld(NOW);
 const result=await snapshots.save(world,{forceBackup:true});
 assert.equal(result.revision,0);
 const status=await snapshots.status(world);
 assert.equal(status.primary.valid,true);
 assert.equal(status.primary.revision,0);
 assert.equal(status.backup_count,1);
 assert.equal(status.backups[0].valid,true);
 assert.equal(status.backups[0].sha256,undefined,'HTTP status does not expose filesystem hashes');
 const files=await fs.readdir(path.join(dir,'snapshots'));
 assert(files.some(s=>s.endsWith('.sha256')));
 assert.equal(digest('world data').length,64);
});
test('Backups use a revision threshold and a fixed retention window',async t=>{
 const {snapshots}=await setup(t,{keep:3,spacing:2});
 const w=W.makeWorld(NOW);
 await snapshots.save(w,{forceBackup:true});
 w.revision=1;await snapshots.save(w);
 assert.equal((await snapshots.status(w)).backup_count,1);
 w.revision=2;await snapshots.save(w);
 assert.equal((await snapshots.status(w)).backup_count,2);
 for(let rev=3;rev<=9;rev++){w.revision=rev;await snapshots.save(w,{forceBackup:true});}
 assert.equal((await snapshots.status(w)).backup_count,3);
 assert.equal((await snapshots.status(w)).primary.revision,9);
});
test('An invalid backup is reported but never substituted for the one-life save',async t=>{
 const {dir,snapshots}=await setup(t);
 const w=W.makeWorld(NOW);
 await snapshots.save(w,{forceBackup:true});
 const files=await fs.readdir(path.join(dir,'snapshots'));
 const backup=files.find(s=>s.endsWith('.json'));
 await fs.appendFile(path.join(dir,'snapshots',backup),'UNAUTHORIZED');
 const status=await snapshots.status(w);
 assert.equal(status.invalid_backups,1);
 assert.equal(status.backup_count,0);
 assert.equal(status.primary.valid,true);
 const primary=await loadWorld(dir,NOW);
 assert.equal(primary.world_id,w.world_id);
});
test('A corrupt primary refuses startup even when a valid backup exists',async t=>{
 const {dir,snapshots}=await setup(t);
 const w=W.makeWorld(NOW);
 await snapshots.save(w,{forceBackup:true});
 await fs.writeFile(path.join(dir,'world.json'),'{corrupt', {mode:0o600});
 const status=await snapshots.status(w);
 assert.equal(status.primary.valid,false);
 assert.equal(status.backup_count,1);
 await assert.rejects(loadWorld(dir,NOW),SyntaxError);
 assert.equal((await fs.readFile(path.join(dir,'world.json'),'utf8')),'{corrupt');
 const candidates=await readCheckpoints(dir,W.validateWorld);
 assert.equal(candidates.filter(x=>x.valid).length,1);
});
test('Bad world data is never written over a previously valid world',async t=>{
 const {dir,snapshots}=await setup(t);
 const w=W.makeWorld(NOW);await snapshots.save(w,{forceBackup:true});
 const before=await fs.readFile(path.join(dir,'world.json'),'utf8');
 const invalid=structuredClone(w);invalid.characters={'1':{slot:99}};
 await assert.rejects(snapshots.save(invalid),/Invalid character/);
 assert.equal(await fs.readFile(path.join(dir,'world.json'),'utf8'),before);
});
test('HTTP status and owner checkpoint are real and permission checked',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dk-m13-http-'));
 const app=await createDKServer({dataDir:dir,port:0,now:()=>NOW});
 t.after(async()=>{if(app.server.listening)await app.close();await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.address.port;
 const response=await fetch(base+'/api/v1/save/status');
 assert.equal(response.status,200);
 const first=await response.json();
 assert.equal(first.primary.valid,true);
 assert(first.backup_count>=1);
 const rejected=await fetch(base+'/api/v1/save/checkpoint',{method:'POST'});
 assert.equal(rejected.status,403);
 const accepted=await fetch(base+'/api/v1/save/checkpoint',{method:'POST',
   headers:{'X-DK-Control':'checkpoint'}});
 assert.equal(accepted.status,200);
 const count=(await(await fetch(base+'/api/v1/save/status')).json()).backup_count;
 assert(count>=2);
 await app.close();
});
