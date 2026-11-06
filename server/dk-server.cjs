'use strict';

// DK Server M1: the service owns new world/character saves. Nothing imports
// browser localStorage or trusts browser-submitted world/character snapshots.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeWorld, validateWorld, createCharacter, worldClock, AREA_ID } = require('./world.cjs');
const { createOwnerAuth } = require('./owner-auth.cjs');

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

async function accessToken(dataDir, supplied) {
  if (supplied !== undefined) {
    if (typeof supplied !== 'string' || supplied.length < 32) throw new Error('DK Server token needs 32+ characters');
    return supplied;
  }
  const file = path.join(dataDir, 'admin-token');
  try {
    const existing = (await fs.readFile(file, 'utf8')).trim();
    if (existing.length < 32) throw new Error('Invalid DK Server access token');
    return existing;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const fresh = crypto.randomBytes(32).toString('hex');
  await durableWrite(file, fresh + '\n', { create: true });
  const loaded = (await fs.readFile(file, 'utf8')).trim();
  if (loaded.length < 32) throw new Error('Invalid DK Server access token');
  return loaded;
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

function isAuthorized(req, token) {
  const authorization = req.headers.authorization || '';
  const candidate = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (candidate.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
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
  now = () => Date.now(), tickMs = 3000, token
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid server port');
  if (!Number.isInteger(tickMs) || tickMs < 250) throw new Error('Invalid clock broadcast interval');
  // The admin key is for a local prototype. Remote access will require real auth/TLS.
  if (!['127.0.0.1', '::1'].includes(host))
    throw new Error('DK Server M1 binds only to loopback (remote access requires authentication)');
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const releaseLock = await acquireWriterLock(dataDir);
  let secret, world, monitorHTML, monitorJS, monitorCSS, playerHTML, playerJS, playerCSS, ownerAuth;
  try {
    secret = await accessToken(dataDir, token);
    world = await loadWorld(dataDir, now());
    monitorHTML = await fs.readFile(path.join(__dirname, 'monitor.html'));
    monitorJS = await fs.readFile(path.join(__dirname, 'monitor.js'));
    monitorCSS = await fs.readFile(path.join(__dirname, 'monitor.css'));
    playerHTML = await fs.readFile(path.join(__dirname, 'player.html'));
    playerJS = await fs.readFile(path.join(__dirname, 'player.js'));
    playerCSS = await fs.readFile(path.join(__dirname, 'player.css'));
    ownerAuth = await createOwnerAuth(dataDir, durableWrite, now);
  } catch (error) { await releaseLock(); throw error; }
  const streams = new Set();
  let server, writeQueue = Promise.resolve();
  function snapshot() {
    return {
      protocol: 'dk.world.v1', mode: 'server-saves', world_id: world.world_id,
      revision: world.revision, clock: worldClock(world, now()), area: world.areas[AREA_ID]
    };
  }
  async function saveCreatedCharacter(slot, name) {
    // Serialize concurrent requests, then write and sync BEFORE acknowledging.
    const pending = writeQueue.then(async () => {
      const result = createCharacter(world, slot, name, now());
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
    if (write && req.headers.origin) {
      const permitted = 'http://' + req.headers.host;
      if (req.headers.origin !== permitted) return sendJSON(res, 403, { error: 'Cross-origin writes are not allowed' });
    }
    if (url.pathname === '/api/v1/auth/status' && !write)
      return sendJSON(res, 200, ownerAuth.status(req), method);
    if (url.pathname === '/api/v1/auth/setup' && method === 'POST' ||
        url.pathname === '/api/v1/auth/login' && method === 'POST') {
      let body;
      try { body = await readJSON(req); }
      catch (e) { return sendJSON(res, e.status || 400, { error: e.message }); }
      if (Object.keys(body).join(',') !== 'password')
        return sendJSON(res, 422, { error: 'Only a password is accepted' });
      const result = url.pathname.endsWith('setup') ? await ownerAuth.setup(body.password, res)
        : await ownerAuth.login(body.password, res);
      return sendJSON(res, result.code, result.body);
    }
    if (url.pathname === '/api/v1/auth/logout' && method === 'POST') {
      ownerAuth.clearSession(req, res);
      return sendJSON(res, 200, { authenticated: false });
    }
    if (url.pathname === '/api/v1/health' && !write) return sendJSON(res, 200,
      { name: 'DK Server', service: 'demon-killer', mode: 'server-saves', online: true }, method);
    if (url.pathname === '/api/v1/world' && !write) return sendJSON(res, 200, snapshot(), method);
    if (url.pathname === '/api/v1/clock' && !write) return sendJSON(res, 200, worldClock(world, now()), method);
    if (url.pathname === '/api/v1/characters' && (method === 'GET' || method === 'HEAD' || method === 'POST')) {
      if (!isAuthorized(req, secret) && !ownerAuth.authenticated(req))
        return sendJSON(res, 401, { error: 'DK Server login required' });
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
      return sendJSON(res, 200, { characters: world.characters, world_revision: world.revision }, method);
    }
    const match = url.pathname.match(/^\/api\/v1\/characters\/([123])$/);
    if (match && !write) {
      if (!isAuthorized(req, secret) && !ownerAuth.authenticated(req))
        return sendJSON(res, 401, { error: 'DK Server login required' });
      const character = world.characters[match[1]];
      return character ? sendJSON(res, 200, { character, world_revision: world.revision }, method)
        : sendJSON(res, 404, { error: 'Empty character slot' }, method);
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
    if (['/', '/monitor.js', '/monitor.css', '/player', '/player.js', '/player.css'].includes(url.pathname) && !write) {
      const js = url.pathname === '/monitor.js' || url.pathname === '/player.js';
      const css = url.pathname === '/monitor.css' || url.pathname === '/player.css';
      const player = url.pathname.startsWith('/player');
      const payload = player ? js ? playerJS : css ? playerCSS : playerHTML :
        js ? monitorJS : css ? monitorCSS : monitorHTML;
      res.writeHead(200, {
        'Content-Type': js ? 'text/javascript; charset=utf-8' : css ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'",
        'Content-Length': payload.length
      });
      return method === 'HEAD' ? res.end() : res.end(payload);
    }
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
  const ticker = setInterval(() => {
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
  createDKServer({ dataDir: directory, port: requestedPort, token: process.env.DK_SERVER_TOKEN })
    .then(instance => {
      console.log('DK Server M1: http://' + instance.address.address + ':' + instance.address.port + '/');
      console.log('World data: ' + path.join(directory, 'world.json'));
      console.log('Owner token (keep private): ' + (process.env.DK_SERVER_TOKEN ? 'environment setting' : path.join(directory, 'admin-token')));
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        instance.close().then(() => process.exit(0), error => { console.error(error); process.exitCode = 1; });
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    })
    .catch(error => { console.error('DK Server refused to start:', error.message); process.exitCode = 1; });
}

module.exports = { createDKServer, loadWorld };
