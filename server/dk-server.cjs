'use strict';

// DK Server M1: the service owns new world/character saves. Nothing imports
// browser localStorage or trusts browser-submitted world/character snapshots.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeWorld, validateWorld, createCharacter, playableCharacter, applyCharacterAction, worldClock, AREA_ID, COURT, VILLAGE, ensureRegions, setWorldRunning, checkpointWorldTime } = require('./world.cjs');
const { localRequestAllowed, serveGame } = require('./local-game.cjs');
const {ensureLivingWorld,advance,collectLetter,recordPlayer,recordWorld}=require('./living-world.cjs');
const {ensureResources,ensureProgress,apply:applyGameplay}=require('./gameplay.cjs');
const {ensureSocial,listing:socialListing,apply:applySocial}=require('./social-m6.cjs');
const {ensure:ensureCombat}=require('./combat-m8.cjs');
const {ensure:ensureStorage}=require('./storage-m9.cjs');
const {reconcile:reconcileEntities,counts:assertEntityCounts,inspect:inspectEntities}=require('./entity-registry-m10.cjs');
const {build:buildSectorIndex,lookup:sectorLookup}=require('./sectors-m10.cjs');
const {ensure:ensureScheduler,listing:schedulerListing}=require('./world-scheduler-m11.cjs');
const {ensure:ensureMobileAssets,read:nearbyCorpses}=require('./mobile-assets-m12.cjs');
const {strategy:createSaveStrategy}=require('./save-strategy-m13.cjs');
const {publicRecord:publicSkills}=require('./skills-m14.cjs');
const {ensure:ensureLaw,listing:lawListing}=require('./law-m15.cjs');
const {ensure:ensureDistricts,current:currentDistrict}=require('./region-policies-m16.cjs');
const {ensure:ensureHousing,listing:housingListing}=require('./housing-m17.cjs');
const {ensure:ensureVendors,listing:vendorListing}=require('./vendors-m18.cjs');
const {ensure:ensureNpcCommerce,listing:npcCommerceListing}=require('./npc-commerce-m19.cjs');
const {ensure:ensureWorkshops,listing:workshopListing}=require('./workshops-m20.cjs');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8766;
const MAX_CLIENTS = 16;
const MAX_BODY = 2048;

async function durableWrite(file, contents, { create = false } = {}) {
  const temporary = file + '.' + process.pid + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close(); handle = null;
    if (create) {
      // Atomic creation; never reset somebody else's world or token.
      try { await fs.link(temporary, file); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    } else await fs.rename(temporary, file);
    const dir = await fs.open(path.dirname(file), 'r');
    try { await dir.sync(); } finally { await dir.close(); }
  } finally {
    if (handle) await handle.close();
    await fs.rm(temporary, { force: true });
  }
}

async function loadWorld(dataDir, now = Date.now()) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, 'world.json');
  try { return validateWorld(JSON.parse(await fs.readFile(file, 'utf8'))); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error; // Never reset corrupt saves.
  }
  await durableWrite(file, JSON.stringify(makeWorld(now), null, 2) + '\n', { create: true });
  return validateWorld(JSON.parse(await fs.readFile(file, 'utf8')));
}

// A writable state directory may have only one owning process. Stale locks
// with a dead PID are recoverable after an abrupt crash; ambiguous locks
// refuse startup instead of risking concurrent writes.
async function acquireWriterLock(dataDir) {
  const lockDir = path.join(dataDir, '.writer-lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fs.mkdir(lockDir, { mode: 0o700 });
      try { await fs.writeFile(path.join(lockDir, 'pid'), String(process.pid), { flag: 'wx', mode: 0o600 }); }
      catch (error) { await fs.rm(lockDir, { recursive: true, force: true }); throw error; }
      return async () => { await fs.rm(lockDir, { recursive: true, force: true }); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = Number(await fs.readFile(path.join(lockDir, 'pid'), 'utf8')); }
      catch (_) { throw new Error('Ambiguous DK Server writer lock; refusing to overwrite world'); }
      if (!Number.isSafeInteger(owner) || owner < 1 || owner === process.pid)
        throw new Error('DK Server world is already owned by another writer');
      try { process.kill(owner, 0); }
      catch (e) {
        if (e.code === 'ESRCH') { await fs.rm(lockDir, { recursive: true, force: true }); continue; }
        throw new Error('Cannot verify DK Server writer lock ownership');
      }
      throw new Error('DK Server world is already owned by another writer');
    }
  }
  throw new Error('Could not acquire DK Server writer lock');
}

async function readJSON(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    const err = new Error('Expected application/json'); err.status = 415; throw err;
  }
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) { const err = new Error('Request too large'); err.status = 413; throw err; }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('not an object');
    return value;
  } catch (_) { const err = new Error('Invalid JSON object'); err.status = 400; throw err; }
}

function sendJSON(res, status, data, method = 'GET') {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': Buffer.byteLength(body)
  });
  if (method === 'HEAD') res.end(); else res.end(body);
}

async function createDKServer({
  dataDir = path.join(__dirname, 'data'), host = DEFAULT_HOST, port = DEFAULT_PORT,
  now = () => Date.now(), tickMs = 3000
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid server port');
  if (!Number.isInteger(tickMs) || tickMs < 250) throw new Error('Invalid clock broadcast interval');
  // Local single-player authority. Remote binding is deliberately disabled.
  if (!['127.0.0.1', '::1'].includes(host))
    throw new Error('DK Server M1 binds only to loopback (remote access requires authentication)');
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const releaseLock = await acquireWriterLock(dataDir);
  const snapshots=createSaveStrategy({dataDir,validateWorld,durableWrite,now});
  let world;
  try {
    await snapshots.init();
    world=await loadWorld(dataDir,now());
    const regionsAdded=ensureRegions(world),livingAdded=ensureLivingWorld(world);
    const resourcesAdded=ensureResources(world);
    const socialAdded=ensureSocial(world);
    const combatAdded=ensureCombat(world);
    const storageAdded=ensureStorage(world);
    const playerAdded=Object.values(world.characters).some(c=>ensureProgress(c));
    const templeDoor=world.areas[AREA_ID]?.objects.find(o=>o.id==='temple_north_door');
    const courtyardDoor=world.areas[COURT]?.objects.find(o=>o.id==='courtyard_temple_door');
    const doorSynced=Boolean(templeDoor&&courtyardDoor&&courtyardDoor.open!==templeDoor.open);
    if(doorSynced)courtyardDoor.open=templeDoor.open;
    const entitiesAdded=reconcileEntities(world);
    const schedulerAdded=ensureScheduler(world);
    const mobileAdded=ensureMobileAssets(world);
    const lawAdded=ensureLaw(world);
    const districtsAdded=ensureDistricts(world);
    const housingAdded=ensureHousing(world);
    const vendorsAdded=ensureVendors(world);
    const vendorEntitiesAdded=reconcileEntities(world);
    const npcCommerceAdded=ensureNpcCommerce(world);
    const workshopsAdded=ensureWorkshops(world);
    assertEntityCounts(world);
    // A stopped world stays frozen. No NPC catch-up or world time is simulated
    // during an intentional server shutdown or an offline host restart.
    if(!world.runtime)world.runtime={
      running:true,elapsed_ms:0,resumed_at_utc:new Date(now()).toISOString()
    };
    else if(world.runtime.running)world.runtime.resumed_at_utc=new Date(now()).toISOString();
    if(regionsAdded||livingAdded||resourcesAdded||socialAdded||combatAdded||storageAdded||entitiesAdded||schedulerAdded||mobileAdded||lawAdded||districtsAdded||housingAdded||vendorsAdded||vendorEntitiesAdded||npcCommerceAdded||workshopsAdded||playerAdded||doorSynced)world.revision++;
    validateWorld(world);
    await snapshots.save(world,{forceBackup:true});
  }catch(error){await releaseLock();throw error;}
  const streams = new Set();
  let server, writeQueue = Promise.resolve(), stopping = false;
  let spatialCache = null;
  const eventLog=path.join(dataDir,'world-events.ndjson');
  async function appendEvents(events){
    if(!events?.length)return;
    const payload=events.map(e=>JSON.stringify(e)).join('\n')+'\n';
    const fd=await fs.open(eventLog,'a',0o600);
    try{await fd.writeFile(payload);await fd.sync();}finally{await fd.close();}
  }
  function snapshot() {
    return {
      protocol: 'dk.world.v1', mode: 'server-saves', world_id: world.world_id,
      revision: world.revision, clock: worldClock(world, now()), area: world.areas[AREA_ID]
    };
  }
  async function createCheckpoint(){
    const pending=writeQueue.then(()=>snapshots.save(world,{forceBackup:true}));
    writeQueue=pending.catch(()=>{});
    return pending;
  }
  async function saveRuntimeChange(running) {
    const pending=writeQueue.then(async()=>{
      if(Boolean(world.runtime?.running??true)===running)
        return {world,changed:false};
      const tick=advance(world,now(),1440);
      const next=setWorldRunning(tick.world,running,now());
      const milestone=recordWorld(next,running?'started':'paused',next.living.minute);
      await snapshots.save(next);
      world=next;
      try{await appendEvents([...tick.events,...(milestone?[milestone]:[])]);}
      catch(e){console.error('World event archive write failed:',e);}
      for(const viewer of streams)push(viewer,'world.state',{running,clock:worldClock(world,now())});
      return {world,changed:true};
    });
    writeQueue=pending.catch(()=>{});
    return pending;
  }
  async function saveCreatedCharacter(slot, name) {
    // Serialize concurrent requests, then write and sync BEFORE acknowledging.
    const pending = writeQueue.then(async () => {
      if(!world.runtime?.running)throw Error('World is paused; press Start Server');
      const tick=advance(world,now(),180);
      const result=createCharacter(checkpointWorldTime(tick.world,now()),slot,name,now());
      const playerEvent=recordPlayer(result.world,'created',result.character,result.world.living.minute);
      await snapshots.save(result.world);
      world=result.world;
      try{await appendEvents([...tick.events,...(playerEvent?[playerEvent]:[])]);}
      catch(e){console.error('World event archive write failed:',e);}
      return result;
    });
    writeQueue = pending.catch(() => {});
    return pending;
  }
  async function saveAction(slot, command) {
    const pending = writeQueue.then(async () => {
      if(!worldClock(world,now()).running)throw Error('World is paused; press Start Server');
      const tick=advance(world,now(),180);
      const result=applyCharacterAction(checkpointWorldTime(tick.world,now()),slot,command);
      reconcileEntities(result.world);
      assertEntityCounts(result.world);
      const playerEvent=recordPlayer(result.world,command,result.character,result.world.living.minute);
      await snapshots.save(result.world);
      world=result.world;
      try{await appendEvents([...tick.events,...(result.events||[]),...(playerEvent?[playerEvent]:[])]);}
      catch(e){console.error('World event archive write failed:',e);}
      return result;
    });
    writeQueue = pending.catch(() => {});
    return pending;
  }
  async function saveGameplayAction(command){
    const pending=writeQueue.then(async()=>{
      if(!world.runtime?.running)throw Error('World is paused; press Start Server');
      const tick=advance(world,now(),180);
      const result=applyGameplay(checkpointWorldTime(tick.world,now()),command,now());
      reconcileEntities(result.world);
      assertEntityCounts(result.world);
      validateWorld(result.world);
      await snapshots.save(result.world);
      world=result.world;
      try{await appendEvents([...tick.events,...(result.events||[result.event])]);}
      catch(e){console.error('World event archive write failed:',e);}
      return result;
    });
    writeQueue=pending.catch(()=>{});return pending;
  }
  async function saveSocialAction(command){
    const pending=writeQueue.then(async()=>{
      if(!world.runtime?.running)throw Error('World is paused; press Start Server');
      const tick=advance(world,now(),180);
      const result=applySocial(checkpointWorldTime(tick.world,now()),command);
      reconcileEntities(result.world);
      assertEntityCounts(result.world);
      validateWorld(result.world);
      await snapshots.save(result.world);
      world=result.world;
      try{await appendEvents([...tick.events,result.event]);}
      catch(e){console.error('Social event archive write failed:',e);}
      return result;
    });
    writeQueue=pending.catch(()=>{});return pending;
  }
  async function saveCollectedLetter(id){
    const pending=writeQueue.then(async()=>{
      if(!world.runtime?.running)throw Error('World is paused; press Start Server');
      const tick=advance(world,now(),180);
      const result=collectLetter(tick.world,id);
      await snapshots.save(result.world);
      world=result.world;
      try{await appendEvents([...tick.events,result.event]);}
      catch(e){console.error('World event archive write failed:',e);}
      return result;
    });
    writeQueue=pending.catch(()=>{});return pending;
  }
  function push(res, event, message) {
    if (res.destroyed || res.writableEnded) return;
    res.write('event: ' + event + '\ndata: ' + JSON.stringify(message) + '\n\n');
  }
  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const method = req.method;
    const write = method !== 'GET' && method !== 'HEAD';
    if (!localRequestAllowed(req, server.address().port))
      return sendJSON(res, 403, { error: 'DK Server is local-only; use this game origin' });
    if (url.pathname === '/api/v1/server/state' && !write)
      return sendJSON(res, 200, { running: worldClock(world,now()).running, clock: worldClock(world,now()), revision: world.revision }, method);
    if (['/api/v1/server/start','/api/v1/server/stop'].includes(url.pathname) && method === 'POST') {
      const starting = url.pathname.endsWith('/start');
      if (req.headers['x-dk-control'] !== (starting?'start':'stop'))
        return sendJSON(res,403,{error:'Use Demon Killer Options to control the world'});
      try {
        const changed = await saveRuntimeChange(starting);
        return sendJSON(res,200,{running:starting, changed:changed.changed,clock:worldClock(world,now())});
      } catch(error) {
        console.error('DK Server start/stop failed:',error);
        return sendJSON(res,500,{error:'World state could not be saved'});
      }
    }
    if (url.pathname === '/api/v1/server/shutdown' && method === 'POST') {
      if (req.headers['x-dk-control'] !== 'shutdown')
        return sendJSON(res, 403, { error: 'Use Demon Killer Options to stop the world' });
      if (stopping) return sendJSON(res, 409, { error: 'Server is already stopping' });
      try { await saveRuntimeChange(false); }
      catch(e) { return sendJSON(res,500,{error:'World pause could not be saved'}); }
      stopping = true;
      sendJSON(res, 202, { stopping: true, message: 'World paused and DK Server stopping' });
      setImmediate(() => server.emit('dk:shutdown'));
      return;
    }
    if (url.pathname === '/api/v1/health' && !write) return sendJSON(res, 200,
      { name: 'DK Server', service: 'demon-killer', mode: 'server-saves', build: 'local-m20', online: true, background_world: true, world_running: worldClock(world,now()).running }, method);
    if (url.pathname === '/api/v1/world' && !write) return sendJSON(res, 200, snapshot(), method);
    if (url.pathname === '/api/v1/clock' && !write) return sendJSON(res, 200, worldClock(world, now()), method);
    if(url.pathname==='/api/v1/areas'&&!write)
      return sendJSON(res,200,{regions:Object.values(world.areas).map(a=>({
        area_id:a.area_id,width:a.width,height:a.height,tile_size:a.tile_size,
        objects:a.objects.length
      }))},method);
    const areaMatch=url.pathname.match(/^\/api\/v1\/areas\/(dk\.[a-z0-9.]+)$/);
    if(areaMatch&&!write){
      const area=world.areas[areaMatch[1]];
      return area?sendJSON(res,200,{area,revision:world.revision},method):
        sendJSON(res,404,{error:'Unknown region'},method);
    }
    if(url.pathname==='/api/v1/workshops'&&!write){
      return sendJSON(res,200,workshopListing(world),method);
    }
    if(url.pathname==='/api/v1/npc-commerce'&&!write){
      return sendJSON(res,200,npcCommerceListing(world),method);
    }
    if(url.pathname==='/api/v1/vendors'&&!write){
      return sendJSON(res,200,vendorListing(world),method);
    }
    if(url.pathname==='/api/v1/housing'&&!write){
      return sendJSON(res,200,housingListing(world),method);
    }
    if(url.pathname==='/api/v1/region/current'&&!write){
      const state=currentDistrict(world);
      return state?sendJSON(res,200,state,method):
        sendJSON(res,404,{error:'No character exists'},method);
    }
    if(url.pathname==='/api/v1/save/status'&&!write){
      return sendJSON(res,200,await snapshots.status(world),method);
    }
    if(url.pathname==='/api/v1/save/checkpoint'&&method==='POST'){
      if(req.headers['x-dk-control']!=='checkpoint')
        return sendJSON(res,403,{error:'Use the Demon Killer menu to save a checkpoint'});
      try{
        const result=await createCheckpoint();
        if(result.backup_error)
          return sendJSON(res,503,{error:'World saved, but checkpoint backup failed'});
        return sendJSON(res,200,{saved:true,revision:result.revision,
          backup_count:(await snapshots.status(world)).backup_count});
      }catch(e){
        console.error('World checkpoint failed:',e);
        return sendJSON(res,500,{error:'World checkpoint could not be saved'});
      }
    }
    if(url.pathname==='/api/v1/corpses'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      return sendJSON(res,200,nearbyCorpses(world),method);
    }
    if(url.pathname==='/api/v1/schedule'&&!write){
      return sendJSON(res,200,{...schedulerListing(world),revision:world.revision},method);
    }
    if(url.pathname==='/api/v1/nearby'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      const raw=url.searchParams.get('radius');
      const radius=raw===null?8:Number(raw);
      if(!Number.isSafeInteger(radius)||radius<1||radius>16)
        return sendJSON(res,422,{error:'Nearby radius must be 1 through 16'},method);
      if(!spatialCache||spatialCache.world_revision!==world.revision)
        spatialCache=buildSectorIndex(world);
      const result=sectorLookup(spatialCache,c.area_id,c.x??8,c.y??12,radius);
      return sendJSON(res,200,{...result,revision:world.revision},method);
    }
    if(url.pathname==='/api/v1/entities/items'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      return sendJSON(res,200,inspectEntities(world),method);
    }
    if(url.pathname==='/api/v1/living'&&!write){
      const l=world.living;
      return sendJSON(res,200,{minute:l.minute,npcs:l.npcs,businesses:l.businesses,
        territories:l.territories,traveling_camps:l.traveling_camps,
        combat:{creatures:l.combat?.creatures||{},drops:l.combat?.drops||{}},
        storage:{ground:l.storage?.ground||{}},
        mobile_assets:{corpses:l.mobile_assets?.corpses||{}},
        pending_mail:l.mail.outbound.length,latest_events:l.events.slice(-30),
        last_event_sequence:l.event_sequence,world_running:worldClock(world,now()).running,
        world_revision:world.revision},method);
    }
    if(url.pathname==='/api/v1/living/events'&&!write){
      const after=Number(url.searchParams.get('after')||0);
      if(!Number.isSafeInteger(after)||after<0)
        return sendJSON(res,400,{error:'Invalid event cursor'},method);
      const entries=world.living.events.filter(e=>Number(e.id.slice(6))>after).slice(0,200);
      return sendJSON(res,200,{events:entries,next:entries.length?
        Number(entries.at(-1).id.slice(6)):after,
        last_event_sequence:world.living.event_sequence},method);
    }
    if(url.pathname==='/api/v1/social'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      return sendJSON(res,200,{...socialListing(world,c),minute:world.living.minute,
        revision:world.revision},method);
    }
    if(url.pathname==='/api/v1/social'&&method==='POST'){
      let body;try{body=await readJSON(req);}
      catch(e){return sendJSON(res,e.status||400,{error:e.message});}
      try{
        const result=await saveSocialAction(body);
        return sendJSON(res,200,{character:playableCharacter(result.character),
          event:result.event,dialogue:result.dialogue||null,
          contract:result.contract||null,reward:result.reward||0,
          reputation_delta:result.reputation_delta||0,revision:result.world.revision});
      }catch(e){
        if(/Invalid/.test(e.message))return sendJSON(res,422,{error:e.message});
        if(/closer|available|Ghosts|No character|closed|already|commission|expired|required|goods|afford|owner|fallen|paused|active|person/.test(e.message))
          return sendJSON(res,409,{error:e.message});
        console.error('Social action failed:',e);
        return sendJSON(res,500,{error:'Social transaction could not be saved'});
      }
    }
    if(url.pathname==='/api/v1/law'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      return sendJSON(res,200,lawListing(world),method);
    }
    if(url.pathname==='/api/v1/skills'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      return sendJSON(res,200,{...publicSkills(c),revision:world.revision},method);
    }
    if(url.pathname==='/api/v1/gameplay'&&!write){
      const c=world.characters['1'];
      if(!c)return sendJSON(res,404,{error:'No character exists'},method);
      const nodes=Object.values(world.living.resources||{}).filter(n=>n.area_id===c.area_id);
      const businesses=Object.values(world.living.businesses).filter(b=>b.area_id===c.area_id);
      return sendJSON(res,200,{character:playableCharacter(c),resources:nodes,
        businesses,minute:world.living.minute,world_running:world.runtime?.running},method);
    }
    if(url.pathname==='/api/v1/gameplay'&&method==='POST'){
      let body;try{body=await readJSON(req);}
      catch(e){return sendJSON(res,e.status||400,{error:e.message});}
      try{
        const result=await saveGameplayAction(body);
        return sendJSON(res,200,{character:playableCharacter(result.character),
          world_revision:result.world.revision,event:result.event});
      }catch(e){
        if(/Invalid/.test(e.message))return sendJSON(res,422,{error:e.message});
        if(/closer|bank|ghost|Ghost|closed|enough|stock|depleted|wait|full|paused|own|near|business|pack|balance|ingredients|equipment|hungry|bandages|unconscious|smithy|slot|recipe|monster|loot|striking|fight|item|chest|vault|ground|container|equip|stored|corpse|body|dead|skill|training|lock|fine|guard|witness|crime/.test(e.message))
          return sendJSON(res,409,{error:e.message});
        console.error('Player gameplay failed:',e);
        return sendJSON(res,500,{error:'Gameplay transaction was not saved'});
      }
    }
    if(url.pathname==='/api/v1/bank/box'&&!write){
      const c=world.characters['1'];
      if(!c||c.area_id!==VILLAGE||Math.abs(c.x-54)+Math.abs(c.y-103)>3)
        return sendJSON(res,409,{error:'Visit the Village Bank to open your box'},method);
      return sendJSON(res,200,{letters:world.living.mail.boxes['1'],
        items:world.living.storage?.vaults?.['1']||{},
        delivered_count:world.living.mail.boxes['1'].length},method);
    }
    if(url.pathname==='/api/v1/bank/collect'&&method==='POST'){
      let body;try{body=await readJSON(req);}
      catch(e){return sendJSON(res,e.status||400,{error:e.message});}
      if(Object.keys(body).join(',')!=='letter_id'||typeof body.letter_id!=='string'||
        !/^letter_[0-9]+$/.test(body.letter_id))
        return sendJSON(res,422,{error:'Invalid letter identifier'});
      try{
        const result=await saveCollectedLetter(body.letter_id);
        return sendJSON(res,200,{letter:result.letter,world_revision:world.revision});
      }catch(e){
        if(/Visit|not in|paused|Ghosts/.test(e.message))return sendJSON(res,409,{error:e.message});
        console.error('Bank collection failed:',e);
        return sendJSON(res,500,{error:'Bank box could not be saved'});
      }
    }
    if (url.pathname === '/api/v1/characters' && (method === 'GET' || method === 'HEAD' || method === 'POST')) {
      if (method === 'POST') {
        let body;
        try { body = await readJSON(req); }
        catch (e) { return sendJSON(res, e.status || 400, { error: e.message }); }
        // Only these two fields are accepted; clients cannot submit a saved state.
        if (Object.keys(body).sort().join(',') !== 'name,slot')
          return sendJSON(res, 422, { error: 'Only slot and name are accepted' });
        try {
          const saved = await saveCreatedCharacter(body.slot, body.name);
          return sendJSON(res, 201, { character: saved.character, world_revision: saved.world.revision });
        } catch (e) {
          if (/already occupied|paused/.test(e.message)) return sendJSON(res, 409, { error: e.message });
          if (/Invalid character slot|Character name/.test(e.message)) return sendJSON(res, 422, { error: e.message });
          console.error('DK Server save failed:', e);
          return sendJSON(res, 500, { error: 'Character not saved; see server log' });
        }
      }
      return sendJSON(res, 200, { characters: Object.fromEntries(Object.entries(world.characters).map(([k,v])=>[k,playableCharacter(v)])), world_revision: world.revision }, method);
    }
    const match = url.pathname.match(/^\/api\/v1\/characters\/(1)$/);
    if (match && !write) {
      const character = world.characters[match[1]];
      return character ? sendJSON(res, 200, { character: playableCharacter(character), world_revision: world.revision }, method)
        : sendJSON(res, 404, { error: 'Empty character slot' }, method);
    }
    const actionMatch = url.pathname.match(/^\/api\/v1\/characters\/(1)\/actions$/);
    if (actionMatch && method === 'POST') {
      let body;
      try { body = await readJSON(req); }
      catch (e) { return sendJSON(res, e.status || 400, { error: e.message }); }
      try {
        const saved = await saveAction(Number(actionMatch[1]), body);
        return sendJSON(res, 200, { character: saved.character, world_revision: saved.world.revision });
      } catch (e) {
        if (/Invalid|Only valid/.test(e.message)) return sendJSON(res, 422, { error: e.message });
        if (/already|blocked|not complete|not available|beside|paused/.test(e.message)) return sendJSON(res, 409, { error: e.message });
        if (/Empty character slot/.test(e.message)) return sendJSON(res, 404, { error: e.message });
        console.error('DK Server action failed:', e);
        return sendJSON(res, 500, { error: 'World action was not saved' });
      }
    }
    if (url.pathname === '/api/v1/events' && !write) {
      if (method === 'HEAD') return sendJSON(res, 405, { error: 'Event stream requires GET' });
      if (streams.size >= MAX_CLIENTS) return sendJSON(res, 503, { error: 'Too many viewers' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store',
        Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff'
      });
      streams.add(res);
      push(res, 'world.snapshot', snapshot());
      res.on('close', () => streams.delete(res));
      return;
    }
    if (!write && await serveGame(req, res, url.pathname)) return;
    if (write) {
      res.setHeader('Allow', 'GET, HEAD');
      return sendJSON(res, 405, { error: 'Command not enabled; the server does not accept arbitrary saves' });
    }
    return sendJSON(res, 404, { error: 'Unknown DK Server endpoint' }, method);
  }
  server = http.createServer((req, res) => { route(req, res).catch(e => {
    console.error('DK Server request error:', e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Internal DK Server error' });
    else res.destroy();
  }); });
  // Checkpoint the authoritative clock periodically even with no browser connected;
  // the pending write queue prevents an older snapshot overwriting gameplay.
  let lastCheckpoint = now();
  const ticker = setInterval(() => {
    if(world.runtime?.running && now()-lastCheckpoint>=5000){
      lastCheckpoint=now();
      const task=writeQueue.then(async()=>{
        const tick=advance(world,now(),180);
        const clockElapsed=now()-Date.parse(world.runtime.resumed_at_utc);
        if(!tick.minutes&&clockElapsed<30_000)return;
        const next=checkpointWorldTime(tick.world,now());
        await snapshots.save(next);
        world=next;
        if(tick.events.length){
          try{await appendEvents(tick.events);}
          catch(e){console.error('World event archive write failed:',e);}
          for(const viewer of streams)push(viewer,'world.living',
            {minute:world.living.minute,events:tick.events.slice(-15)});
        }
      });
      writeQueue=task.catch(e=>console.error('Living world tick failed:',e));
    }
    const clock = worldClock(world, now());
    for (const res of streams) {
      if (res.destroyed || res.writableEnded) streams.delete(res);
      else push(res, 'world.clock', clock);
    }
  }, tickMs);
  ticker.unref();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(); });
    });
  } catch (error) { clearInterval(ticker); await releaseLock(); throw error; }
  return {
    server, address: server.address(), snapshot,
    get world() { return world; },
    async close() {
      clearInterval(ticker);
      await writeQueue;
      if(world.runtime?.running){
        const tick=advance(world,now(),1440);
        const next=setWorldRunning(tick.world,false,now());
        const milestone=recordWorld(next,'paused',next.living.minute);
        await snapshots.save(next,{forceBackup:true});
        world=next;
        try{await appendEvents([...tick.events,...(milestone?[milestone]:[])]);}
        catch(e){console.error('World event archive write failed:',e);}
      }
      for (const res of streams) res.end();
      streams.clear();
      try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
      finally { await releaseLock(); }
    }
  };
}

if (require.main === module) {
  const directory = process.env.DK_SERVER_DATA || path.join(__dirname, 'data');
  const requestedPort = process.env.DK_SERVER_PORT === undefined ? DEFAULT_PORT : Number(process.env.DK_SERVER_PORT);
  createDKServer({ dataDir: directory, port: requestedPort })
    .then(instance => {
      console.log('Demon Killer + DK Server: http://' + instance.address.address + ':' + instance.address.port + '/');
      console.log('World data: ' + path.join(directory, 'world.json'));
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        instance.close().then(() => process.exit(0), error => { console.error(error); process.exitCode = 1; });
      };
      instance.server.on('dk:shutdown', stop);
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    })
    .catch(error => { console.error('DK Server refused to start:', error.message); process.exitCode = 1; });
}

module.exports = { createDKServer, loadWorld };
