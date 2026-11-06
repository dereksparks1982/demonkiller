'use strict';

// DK Server M1: the service owns new world/character saves. Nothing imports
// browser localStorage or trusts browser-submitted world/character snapshots.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeWorld, validateWorld, createCharacter, playableCharacter, applyCharacterAction, worldClock, AREA_ID, setWorldRunning, checkpointWorldTime } = require('./world.cjs');
const { localRequestAllowed, serveGame } = require('./local-game.cjs');

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
  let world;
  try {
    world = await loadWorld(dataDir, now());
  } catch (error) { await releaseLock(); throw error; }
  // A process restart never advances the clock for the time DK Server was down.
  // A running world resumes automatically; a deliberately stopped one stays paused.
  if (world.runtime?.running) {
    world.runtime.resumed_at_utc = new Date(now()).toISOString();
    await durableWrite(path.join(dataDir, 'world.json'), JSON.stringify(world, null, 2) + '\n');
  }
  const streams = new Set();
  let server, writeQueue = Promise.resolve(), stopping = false;
  function snapshot() {
    return {
      protocol: 'dk.world.v1', mode: 'server-saves', world_id: world.world_id,
      revision: world.revision, clock: worldClock(world, now()), area: world.areas[AREA_ID]
    };
  }
  async function saveRuntimeChange(running) {
    const pending = writeQueue.then(async () => {
      if (Boolean(world.runtime?.running ?? true) === running)
        return { world, changed: false };
      const next = setWorldRunning(world, running, now());
      await durableWrite(path.join(dataDir,'world.json'), JSON.stringify(next,null,2)+'\n');
      world = next;
      for (const viewer of streams) push(viewer,'world.state', {running, clock: worldClock(world,now())});
      return {world,changed:true};
    });
    writeQueue = pending.catch(()=>{});
    return pending;
  }
  async function saveCreatedCharacter(slot, name) {
    // Serialize concurrent requests, then write and sync BEFORE acknowledging.
    const pending = writeQueue.then(async () => {
      const result = createCharacter(checkpointWorldTime(world, now()), slot, name, now());
      await durableWrite(path.join(dataDir, 'world.json'), JSON.stringify(result.world, null, 2) + '\n');
      world = result.world;
      return result;
    });
    writeQueue = pending.catch(() => {});
    return pending;
  }
  async function saveAction(slot, command) {
    const pending = writeQueue.then(async () => {
      if (!worldClock(world, now()).running) throw new Error('World is paused; press Start Server');
      const result = applyCharacterAction(checkpointWorldTime(world, now()), slot, command);
      await durableWrite(path.join(dataDir, 'world.json'), JSON.stringify(result.world, null, 2) + '\n');
      world = result.world;
      return result;
    });
    writeQueue = pending.catch(() => {});
    return pending;
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
      { name: 'DK Server', service: 'demon-killer', mode: 'server-saves', build: 'local-m4', online: true, background_world: true, world_running: worldClock(world,now()).running }, method);
    if (url.pathname === '/api/v1/world' && !write) return sendJSON(res, 200, snapshot(), method);
    if (url.pathname === '/api/v1/clock' && !write) return sendJSON(res, 200, worldClock(world, now()), method);
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
          if (/already occupied/.test(e.message)) return sendJSON(res, 409, { error: e.message });
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
    if (world.runtime?.running && now()-lastCheckpoint >= 30_000) {
      lastCheckpoint = now();
      const task = writeQueue.then(async()=>{
        const next = checkpointWorldTime(world, now());
        await durableWrite(path.join(dataDir,'world.json'), JSON.stringify(next,null,2)+'\n');
        world=next;
      });
      writeQueue=task.catch(e=>console.error('World clock checkpoint failed:',e));
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
      if (world.runtime?.running) {
        const next = setWorldRunning(world,false,now());
        await durableWrite(path.join(dataDir,'world.json'),JSON.stringify(next,null,2)+'\n');
        world=next;
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
