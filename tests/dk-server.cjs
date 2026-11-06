'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDKServer, loadWorld } = require('../server/dk-server.cjs');
const { AREA_ID, templeTemplate, makeWorld, validateWorld, worldClock, DAY_MS } = require('../server/world.cjs');

async function tempWorld(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'dk-server-m1-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  return folder;
}
function objectAt(area, id) { return area.objects.find(item => item.id === id); }
function post(base, data, headers = {}) {
  return fetch(base + '/api/v1/characters', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) });
}

test('approved Forsaken Temple geometry remains unchanged; no premature crystal or old saves', () => {
  const room = templeTemplate();
  assert.equal(room.area_id, AREA_ID);
  assert.equal(room.width, 16);
  assert.equal(room.height, 16);
  assert.equal(room.tile_size, 32);
  for (const key of ['floor', 'walls', 'wallStyles', 'wallVariants', 'wallPacks', 'wallRotations', 'floorArt'])
    assert.equal(room[key].length, 256);
  assert.deepEqual(objectAt(room, 'sacrifice_altar'), { id: 'sacrifice_altar', type: 'altar', x: 7, y: 5, r: 0 });
  assert.equal(objectAt(room, 'temple_north_door').open, false);
  assert.equal(room.walls[8], 0);
  assert.equal(room.walls[7], 1);
  assert.deepEqual(room.spawn, { x: 8, y: 12 });
  assert.equal(room.objects.length, 9);
  assert.ok(!room.objects.some(item => item.type === 'crystal'));
  const world = validateWorld(makeWorld(Date.UTC(2026, 10, 6)));
  assert.deepEqual(world.characters, {});
  assert.equal(world.revision, 0);
  assert.ok(!('localStorage' in world));
});

test('six-hour day, six-hour night, exact transition boundaries and cycle counts', () => {
  const start = Date.UTC(2026, 10, 6, 0, 0, 0);
  const world = makeWorld(start);
  assert.equal(worldClock(world, start).phase, 'day');
  assert.equal(worldClock(world, start).seconds_until_transition, 21600);
  assert.equal(worldClock(world, start + DAY_MS - 1).phase, 'day');
  assert.equal(worldClock(world, start + DAY_MS).phase, 'night');
  assert.equal(worldClock(world, start + DAY_MS).seconds_until_transition, 21600);
  assert.equal(worldClock(world, start + DAY_MS * 2).phase, 'day');
  assert.equal(worldClock(world, start + DAY_MS * 2).cycle, 1);
  assert.equal(worldClock(world, start + DAY_MS * 5).phase, 'night');
});

test('new server-owned characters persist after restart; world clock never resets', async t => {
  const dir = await tempWorld(t);
  const origin = Date.UTC(2026, 10, 6, 0, 0, 0);
  const first = await createDKServer({ dataDir: dir, port: 0, now: () => origin });
  t.after(() => first.server.listening ? first.close() : Promise.resolve());
  const base = 'http://127.0.0.1:' + first.address.port;
  const response = await post(base, { slot: 1, name: 'Derek' });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.character.name, 'DEREK');
  assert.equal(created.character.area_id, AREA_ID);
  assert.equal(created.character.form, 'ghost');
  assert.equal(created.character.opening_state, 'not_started');
  assert.equal(created.world_revision, 1);
  assert.deepEqual(Object.keys((await (await fetch(base + '/api/v1/world')).json())),
    ['protocol', 'mode', 'world_id', 'revision', 'clock', 'area']);
  await first.close();
  const advanced = origin + DAY_MS + 19000;
  const second = await createDKServer({ dataDir: dir, port: 0, now: () => advanced });
  t.after(() => second.server.listening ? second.close() : Promise.resolve());
  assert.equal(second.world.clock_anchor_utc, new Date(origin).toISOString());
  assert.equal(second.snapshot().clock.phase, 'night');
  assert.equal(second.snapshot().clock.elapsed_in_phase_seconds, 19);
  assert.equal(second.snapshot().area.objects.length, 9);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'world.json'), 'utf8'));
  assert.equal(saved.world_id, 'dk.world.001');
  assert.equal(saved.revision, 1);
  assert.equal(saved.characters['1'].name, 'DEREK');
  assert.equal((await (await fetch('http://127.0.0.1:' + second.address.port + '/api/v1/characters/1', )).json()).character.name, 'DEREK');
  await second.close();
});

test('corrupt or legacy worlds refuse startup without replacement or import', async t => {
  const dir = await tempWorld(t);
  const file = path.join(dir, 'world.json');
  await fs.writeFile(file, '{invalid:json\n');
  await assert.rejects(loadWorld(dir), SyntaxError);
  assert.equal(await fs.readFile(file, 'utf8'), '{invalid:json\n');
  await fs.writeFile(file, JSON.stringify({ schema_version: 999 }));
  await assert.rejects(loadWorld(dir), /Unsupported DK Server save version/);
  const legacy = makeWorld(Date.now()); delete legacy.characters;
  await fs.writeFile(file, JSON.stringify(legacy));
  await assert.rejects(loadWorld(dir), /Invalid server-owned character store/);
  assert.ok(!JSON.parse(await fs.readFile(file, 'utf8')).characters);
});

test('single-player server-owned slot creation rejects forged saves and unsafe requests', async t => {
  const dir = await tempWorld(t);
  const app = await createDKServer({ dataDir: dir, port: 0 });
  t.after(() => app.server.listening ? app.close() : Promise.resolve());
  const base = 'http://127.0.0.1:' + app.address.port;
  const health = await fetch(base + '/api/v1/health');
  assert.equal((await health.json()).name, 'DK Server');
  const world = await fetch(base + '/api/v1/world');
  assert.equal(world.status, 200);
  assert.equal(world.headers.get('access-control-allow-origin'), null);
  const snapshot = await world.json();
  assert.equal(snapshot.protocol, 'dk.world.v1');
  assert.equal(snapshot.mode, 'server-saves');
  assert.equal(snapshot.area.area_id, AREA_ID);
  assert.ok(!('characters' in snapshot), 'Private characters must not leak into world snapshot');
  assert.equal((await (await fetch(base + '/api/v1/clock')).json()).day_real_seconds, 21600);
  assert.equal((await fetch(base + '/')).status, 200);
  assert.match(await (await fetch(base + '/')).text(), /DEMON KILLER/);
  assert.equal((await fetch(base + '/api/v1/characters')).status, 200);
  assert.equal((await fetch(base + '/api/v1/characters/1')).status, 404);
  assert.equal((await fetch(base + '/server/data/world.json')).status, 404);
  assert.equal((await fetch(base + '/monitor.js')).status, 404);
  assert.equal((await post(base, { slot: 1, name: 'Elias' }, { origin: 'https://malicious.example' })).status, 403);
  assert.equal((await post(base, { slot: 1, name: 'Elias', form: 'living' })).status, 422);
  assert.equal((await post(base, { slot: 1, name: 'Elias', client_save: {} })).status, 422);
  assert.equal((await post(base, { slot: 0, name: 'Elias' })).status, 422);
  assert.equal((await post(base, { slot: 1, name: 'WayTooLongName' })).status, 422);
  assert.equal((await fetch(base + '/api/v1/world', { method: 'POST', body: '{"form":"living"}' })).status, 405);
  assert.equal((await fetch(base + '/api/v1/world', { method: 'DELETE' })).status, 405);
  assert.equal((await fetch(base + '/api/v1/world', { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(base + '/missing')).status, 404);
  assert.equal(app.world.revision, 0, 'Failed writes cannot mutate world state');
  assert.equal((await post(base, { slot: 1, name: 'Elias' })).status, 201);
  assert.equal((await post(base, { slot: 1, name: 'Another' })).status, 409);
  assert.equal((await post(base, { slot: 2, name: 'Mary' })).status, 201);
  assert.equal(app.world.revision, 2);
  const chars = await (await fetch(base + '/api/v1/characters', )).json();
  assert.equal(chars.characters['1'].name, 'ELIAS');
  assert.equal(chars.characters['2'].name, 'MARY');
  assert.equal((await fetch(base + '/api/v1/characters/3', )).status, 404);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'world.json'), 'utf8')).revision, 2);
  await app.close();
});

test('parallel requests cannot overwrite an occupied slot', async t => {
  const dir = await tempWorld(t);
  const app = await createDKServer({ dataDir: dir, port: 0 });
  t.after(() => app.server.listening ? app.close() : Promise.resolve());
  const base = 'http://127.0.0.1:' + app.address.port;
  const codes = (await Promise.all([
    post(base, { slot: 3, name: 'One' }), post(base, { slot: 3, name: 'Two' })
  ])).map(r => r.status).sort();
  assert.deepEqual(codes, [201, 409]);
  assert.equal(app.world.revision, 1);
  await app.close();
});

test('two writers cannot open one world directory simultaneously', async t => {
  const dir = await tempWorld(t);
  const app = await createDKServer({ dataDir: dir, port: 0 });
  t.after(() => app.server.listening ? app.close() : Promise.resolve());
  await assert.rejects(createDKServer({ dataDir: dir, port: 0 }), /already owned/);
  await app.close();
  const next = await createDKServer({ dataDir: dir, port: 0 });
  await next.close();
});

test('SSE emits public world snapshot and fresh clock without the browser present', async t => {
  const dir = await tempWorld(t);
  const app = await createDKServer({ dataDir: dir, port: 0, tickMs: 250 });
  t.after(() => app.server.listening ? app.close() : Promise.resolve());
  const res = await fetch('http://127.0.0.1:' + app.address.port + '/api/v1/events');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const reader = res.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: world\.snapshot/);
  assert.doesNotMatch(first, /"characters"/);
  await reader.cancel();
  assert.equal(app.server.listening, true);
  await app.close();
});

test('unsafe remote binding denied until full player authentication and TLS', async t => {
  const dir = await tempWorld(t);
  await assert.rejects(createDKServer({ dataDir: dir, host: '0.0.0.0', port: 0 }), /loopback/);
});
