'use strict';

// DK Server's first immutable-area snapshot mirrors the approved playable
// Forsaken Temple. No player-character progression is shared or invented here.
const AREA_ID = 'dk.temple.sacrifice.001';
const GRID_SIZE = 16;
const TILE_SIZE = 32;
const DAY_MS = 6 * 60 * 60 * 1000;
const CYCLE_MS = DAY_MS * 2;
const SCHEMA_VERSION = 1;

function templeTemplate() {
  const n = GRID_SIZE, count = n * n;
  const walls = Array(count).fill(0);
  const floor = Array(count).fill('stone');
  const wallStyles = Array(count).fill('clean');
  const wallVariants = Array(count).fill(null);
  const wallPacks = Array(count).fill('ox72i');
  const wallRotations = Array(count).fill(0);
  const floorArt = Array(count).fill(null);
  const at = (x, y) => y * n + x;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (x === 0 || y === 0 || x === n - 1 || y === n - 1) {
      walls[at(x, y)] = 1;
      const wear = (x * 13 + y * 17) % 13;
      wallStyles[at(x, y)] = wear === 0 ? 'broken' : wear === 3 ? 'cracked' : wear === 6 ? 'moss' : 'clean';
    }
    if ((x + y) % 7 === 0) floor[at(x, y)] = 'cracked';
    if (x >= 5 && x <= 10 && y >= 4 && y <= 9) floor[at(x, y)] = 'dark';
    if ((x === 7 || x === 8) && y >= 7 && y <= 10) floor[at(x, y)] = 'sigil';
  }
  walls[at(8, 0)] = 0;
  wallStyles[at(8, 0)] = 'clean';
  return {
    area_id: AREA_ID, schema: 1, tile_size: TILE_SIZE, width: n, height: n,
    floor, walls, wallStyles, wallVariants, wallPacks, wallRotations, floorArt,
    objects: [
      { id: 'temple_north_door', type: 'door', x: 8, y: 0, r: 0, open: false },
      { id: 'sacrifice_altar', type: 'altar', x: 7, y: 5, r: 0 },
      { id: 'brazier_west', type: 'braziers', x: 4, y: 4, r: 0 },
      { id: 'brazier_east', type: 'braziers', x: 11, y: 4, r: 0 },
      { id: 'pillar_west', type: 'pillar', x: 3, y: 2, r: 0 },
      { id: 'pillar_east', type: 'pillar', x: 12, y: 2, r: 0 },
      { id: 'pew_west', type: 'pew', x: 3, y: 10, r: 0 },
      { id: 'pew_east', type: 'pew', x: 11, y: 10, r: 0 },
      { id: 'candle_near_altar', type: 'candle', x: 13, y: 9, r: 0 }
    ],
    spawn: { x: 8, y: 12 }
  };
}

function makeWorld(now = Date.now()) {
  if (!Number.isFinite(now) || now < 0) throw new Error('Invalid world creation time');
  return {
    schema_version: SCHEMA_VERSION,
    world_id: 'dk.world.001',
    created_at_utc: new Date(now).toISOString(),
    clock_anchor_utc: new Date(now).toISOString(),
    revision: 0,
    areas: { [AREA_ID]: templeTemplate() },
    characters: {}
  };
}

function validateWorld(world) {
  if (!world || world.schema_version !== SCHEMA_VERSION || world.world_id !== 'dk.world.001')
    throw new Error('Unsupported DK Server save version or world identity; refusing overwrite');
  if (!Number.isSafeInteger(world.revision) || world.revision < 0)
    throw new Error('Invalid persistent world revision');
  if (!world.characters || Array.isArray(world.characters) || typeof world.characters !== 'object')
    throw new Error('Invalid server-owned character store');
  for (const [slot, character] of Object.entries(world.characters)) {
    if (!/^[123]$/.test(slot) || !character || character.slot !== Number(slot) ||
        typeof character.name !== 'string' || !/^[A-Z0-9 _-]{1,8}$/.test(character.name) ||
        character.area_id !== AREA_ID || character.form !== 'ghost' ||
        character.opening_state !== 'not_started' || !Number.isSafeInteger(character.revision) ||
        character.revision !== 1 || !Number.isFinite(Date.parse(character.created_at_utc)))
      throw new Error('Invalid character record in DK Server data');
  }
  const anchor = Date.parse(world.clock_anchor_utc);
  if (!Number.isFinite(anchor) || new Date(anchor).toISOString() !== world.clock_anchor_utc)
    throw new Error('Invalid persistent clock anchor');
  const area = world.areas?.[AREA_ID];
  if (!area || area.area_id !== AREA_ID || area.width !== GRID_SIZE || area.height !== GRID_SIZE || area.tile_size !== TILE_SIZE)
    throw new Error('Invalid temple dimensions or area');
  for (const key of ['floor', 'walls', 'wallStyles', 'wallVariants', 'wallPacks', 'wallRotations', 'floorArt']) {
    if (!Array.isArray(area[key]) || area[key].length !== GRID_SIZE * GRID_SIZE)
      throw new Error('Invalid temple ' + key + ' grid');
  }
  if (!Array.isArray(area.objects) || area.objects.length > 2048) throw new Error('Invalid temple objects');
  const ids = new Set();
  for (const object of area.objects) {
    if (!object || typeof object.id !== 'string' || !/^[a-z0-9_-]{1,80}$/.test(object.id) || ids.has(object.id) ||
        !Number.isInteger(object.x) || !Number.isInteger(object.y) || object.x < 0 || object.y < 0 || object.x >= GRID_SIZE || object.y >= GRID_SIZE)
      throw new Error('Invalid or duplicate temple object');
    ids.add(object.id);
  }
  if (!ids.has('sacrifice_altar') || !ids.has('temple_north_door'))
    throw new Error('Required approved temple objects missing');
  return world;
}

function createCharacter(world, slot, name, now = Date.now()) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new Error('Invalid character slot');
  if (typeof name !== 'string' || !/^[A-Za-z0-9 _-]{1,8}$/.test(name.trim()))
    throw new Error('Character name must be 1 to 8 letters, numbers, spaces, underscores or hyphens');
  if (Object.hasOwn(world.characters, String(slot))) throw new Error('Character slot is already occupied');
  if (!Number.isFinite(now) || now < 0) throw new Error('Invalid creation timestamp');
  const character = {slot, name: name.trim().toUpperCase(), revision: 1,
    created_at_utc: new Date(now).toISOString(), area_id: AREA_ID,
    form: 'ghost', opening_state: 'not_started'};
  const next = structuredClone(world);
  next.characters[String(slot)] = character;
  next.revision++;
  validateWorld(next);
  return {world: next, character};
}

function worldClock(world, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(world.clock_anchor_utc));
  const position = elapsed % CYCLE_MS;
  const phase = position < DAY_MS ? 'day' : 'night';
  const phaseElapsed = position % DAY_MS;
  return {
    utc_now: new Date(now).toISOString(),
    clock_anchor_utc: world.clock_anchor_utc,
    phase,
    cycle: Math.floor(elapsed / CYCLE_MS),
    elapsed_in_phase_seconds: Math.floor(phaseElapsed / 1000),
    seconds_until_transition: Math.ceil((DAY_MS - phaseElapsed) / 1000),
    day_real_seconds: DAY_MS / 1000,
    night_real_seconds: DAY_MS / 1000
  };
}

module.exports = { AREA_ID, GRID_SIZE, TILE_SIZE, DAY_MS, CYCLE_MS, templeTemplate, makeWorld, validateWorld, createCharacter, worldClock };
