'use strict';
// DK Server M13: independent, crash-conscious world save strategy.
// Main world.json is atomic; verified rotating checkpoints never overwrite it
// on recovery. Existing single-writer queue must serialize calls to save().
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const BACKUPS=5,REVISION_SPACING=25,MAX_BACKUP_BYTES=64*1024*1024;
const NAME=/^snapshot-([0-9]{13})-r([0-9]{10})-([a-f0-9]{12})\.json$/;
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
async function readCheckpoints(dataDir,validateWorld){
 const dir=path.join(dataDir,'snapshots');
 let entries;
 try{entries=(await fs.readdir(dir)).filter(n=>NAME.test(n)).sort().reverse();}
 catch(e){if(e.code==='ENOENT')return [];throw e;}
 const rows=[];
 for(const name of entries){
  const absolute=path.join(dir,name),row={name,valid:false,revision:null,sha256:null};
  try{
   const st=await fs.stat(absolute);
   if(st.size>MAX_BACKUP_BYTES)throw Error('Snapshot exceeds allowed size');
   const data=await fs.readFile(absolute);
   const expected=(await fs.readFile(absolute+'.sha256','utf8')).trim();
   const hash=digest(data);
   if(!/^[a-f0-9]{64}$/.test(expected)||hash!==expected)
    throw Error('Snapshot checksum mismatch');
   const world=validateWorld(JSON.parse(data.toString('utf8')));
   if(world.revision!==Number(name.match(NAME)[2]))
    throw Error('Revision does not match checkpoint filename');
   row.valid=true;row.revision=world.revision;row.sha256=hash;
   row.world_minute=world.living?.minute||0;
  }catch(e){row.error=e.message;}
  rows.push(row);
 }
 return rows;
}
function strategy({dataDir,validateWorld,durableWrite,now=Date.now,keep=BACKUPS,spacing=REVISION_SPACING}){
 if(!dataDir||typeof validateWorld!=='function'||typeof durableWrite!=='function'||
    !Number.isInteger(keep)||keep<2||keep>20||
    !Number.isInteger(spacing)||spacing<1||spacing>10000)
  throw Error('Invalid snapshot strategy setup');
 const dir=path.join(dataDir,'snapshots'),primary=path.join(dataDir,'world.json');
 let lastBackupRevision=-1,lastError=null,backupsCreated=0;
 async function init(){
   await fs.mkdir(dir,{recursive:true,mode:0o700});
   const entries=await readCheckpoints(dataDir,validateWorld);
   lastBackupRevision=entries.filter(x=>x.valid).reduce((n,x)=>Math.max(n,x.revision),-1);
 }
 async function checkpoint(world,serialized){
   validateWorld(world);
   const body=serialized??JSON.stringify(world,null,2)+'\n';
   if(Buffer.byteLength(body)>MAX_BACKUP_BYTES)throw Error('World checkpoint exceeds maximum size');
   await fs.mkdir(dir,{recursive:true,mode:0o700});
   const stamp=String(Math.max(0,Math.floor(now()))).padStart(13,'0');
   const rev=String(world.revision).padStart(10,'0');
   const name='snapshot-'+stamp+'-r'+rev+'-'+crypto.randomBytes(6).toString('hex')+'.json';
   const output=path.join(dir,name);
   // A snapshot without its checksum sidecar is INVALID and never used.
   await durableWrite(output,body,{create:true});
   await durableWrite(output+'.sha256',digest(body)+'\n',{create:true});
   lastBackupRevision=Math.max(lastBackupRevision,world.revision);
   backupsCreated++;
   await prune();
   return {revision:world.revision,name};
 }
 async function prune(){
   const entries=await readCheckpoints(dataDir,validateWorld);
   const valid=entries.filter(x=>x.valid);
   if(valid.length<=keep)return;
   // Sort oldest by file birthtime/mtime (stable fallback filename).
   const enriched=await Promise.all(valid.map(async row=>{
     const st=await fs.stat(path.join(dir,row.name));
     return {...row,mtime:st.mtimeMs};
   }));
   enriched.sort((a,b)=>a.mtime-b.mtime||a.name.localeCompare(b.name));
   for(const old of enriched.slice(0,Math.max(0,enriched.length-keep))){
     await fs.rm(path.join(dir,old.name),{force:true});
     await fs.rm(path.join(dir,old.name+'.sha256'),{force:true});
   }
 }
 // Used ONLY for a confirmed full-world reset. Old checkpoints must not be
 // mistaken for snapshots of a new world that happens to reuse revision 0.
 async function prepareWorldReset(){
   await fs.rm(dir,{recursive:true,force:true});
   await fs.mkdir(dir,{recursive:true,mode:0o700});
   lastBackupRevision=-1;lastError=null;backupsCreated=0;
 }
 async function save(world,{forceBackup=false}={}){
   validateWorld(world);
   const body=JSON.stringify(world,null,2)+'\n';
   await durableWrite(primary,body);
   // The authoritative write already succeeded. Never report it as failed
   // merely because a *secondary* backup failed after the commit.
   if(forceBackup||lastBackupRevision<0||
     world.revision-lastBackupRevision>=spacing){
     try{await checkpoint(world,body);lastError=null;}
     catch(e){lastError=e.message;}
   }
   return {revision:world.revision,backup_error:lastError};
 }
 async function status(world){
   const rows=await readCheckpoints(dataDir,validateWorld);
   let primaryState={valid:false,revision:null};
   try{
     const str=await fs.readFile(primary,'utf8');
     const active=validateWorld(JSON.parse(str));
     primaryState={valid:true,revision:active.revision,world_minute:active.living?.minute||0,
       sha256:digest(str)};
   }catch(e){primaryState={valid:false,error:e.message};}
   return {primary:primaryState,
     backup_count:rows.filter(x=>x.valid).length,
     invalid_backups:rows.filter(x=>!x.valid).length,
     last_backup_revision:lastBackupRevision,
     last_backup_error:lastError,
     new_backups_this_session:backupsCreated,
     backups:rows.map(x=>({revision:x.revision,valid:x.valid,
       world_minute:x.world_minute??null,error:x.error||null})),
     current_revision:world?.revision??null,
     recovery_policy:'Never automatically replace or roll back the one-life world'};
 }
 return {init,save,checkpoint,status,prune,prepareWorldReset};
}
module.exports={BACKUPS,REVISION_SPACING,MAX_BACKUP_BYTES,digest,
 readCheckpoints,strategy};
