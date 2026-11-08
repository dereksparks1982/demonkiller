'use strict';

// DK Server's first immutable-area snapshot mirrors the approved playable
// Forsaken Temple. No player-character progression is shared or invented here.
const {TEMPLE,COURT,VILLAGE,courtyard,village,ensureRegions,traversable,portal,checkRegion}=require('./regions.cjs');
const {seed,validateLiving}=require('./living-world.cjs');
const {ensureProgress,ensureResources,validateProgress}=require('./gameplay.cjs');
const {ensureSocial,validateSocial}=require('./social-m6.cjs');
const {ensure:ensureCombat,validate:validateCombat}=require('./combat-m8.cjs');
const SPAWNERS=require('./spawners-m59.cjs');
const GUARDS=require('./guard-watch-m61.cjs');
const GARRISON=require('./garrison-m62.cjs');
const REFUGEES=require('./refugees-m63.cjs');
const TRAFFIC=require('./npc-traffic-m64.cjs');
const {ensure:ensureStorage,validate:validateStorage}=require('./storage-m9.cjs');
const {reconcile:reconcileEntities,validate:validateEntities}=require('./entity-registry-m10.cjs');
const {ensure:ensureScheduler,validate:validateScheduler}=require('./world-scheduler-m11.cjs');
const {ensure:ensureMobileAssets,validate:validateMobileAssets}=require('./mobile-assets-m12.cjs');
const {ensure:ensureLaw,validate:validateLaw}=require('./law-m15.cjs');
const {ensure:ensureDistricts,validate:validateDistricts,onPlayerMove}=require('./region-policies-m16.cjs');
const {ensure:ensureHousing,validate:validateHousing}=require('./housing-m17.cjs');
const {ensure:ensureVendors,validate:validateVendors}=require('./vendors-m18.cjs');
const {ensure:ensureNpcCommerce,validate:validateNpcCommerce}=require('./npc-commerce-m19.cjs');
const {ensure:ensureWorkshops,validate:validateWorkshops}=require('./workshops-m20.cjs');
const {ensure:ensureMobileAI,validate:validateMobileAI}=require('./mobile-ai-m21.cjs');
const {ensure:ensureHarvest,validate:validateHarvest}=require('./npc-harvest-m22.cjs');
const {ensure:ensureSuccession,validate:validateSuccession}=require('./npc-succession-m23.cjs');
const {ensure:ensureCaravans,validate:validateCaravans}=require('./caravan-logistics-m24.cjs');
const {ensure:ensureScavengers,validate:validateScavengers}=require('./scavengers-m30.cjs');
const {ensure:ensureBurials,validate:validateBurials}=require('./burials-m30.cjs');
const {ensure:ensureCells,validate:validateCells,onPlayerMove:cellMove}=require('./streaming-cells-m33.cjs');
const {ensure:ensureInteriors,validate:validateInteriors}=require('./interior-drafts-m35.cjs');
const FIELD=require('./field-skills-m43.cjs');
const BOUNTIES=require('./bounties-m45.cjs');
const COMPANIONS=require('./companions-m46.cjs');
const MILLING=require('./milling-m47.cjs');
const BUSINESS=require('./player-business-m48.cjs');
const MAINTENANCE=require('./business-maintenance-m50.cjs');
const ARMORY=require('./armory-m54.cjs');
const ARMORER=require('./armorer-m55.cjs');
const HUNTING=require('./hunting-m56.cjs');
const AREA_ID=TEMPLE;
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
  const result={
    schema_version: SCHEMA_VERSION,
    world_id: 'dk.world.001',
    created_at_utc: new Date(now).toISOString(),
    clock_anchor_utc: new Date(now).toISOString(),
    revision: 0,
    areas: { [AREA_ID]: templeTemplate(),[COURT]:courtyard(),[VILLAGE]:village() },
    characters: {},living:seed(),
    runtime: { running: true, elapsed_ms: 0, resumed_at_utc: new Date(now).toISOString() }
  };
  ensureResources(result);
  ensureSocial(result);
  ensureCombat(result);
  SPAWNERS.ensure(result);
  GUARDS.ensure(result);
  GARRISON.ensure(result);
  REFUGEES.ensure(result);
  TRAFFIC.ensure(result);
  ensureStorage(result);
  reconcileEntities(result);
  ensureScheduler(result);
  ensureMobileAssets(result);
  ensureLaw(result);
  ensureDistricts(result);
  ensureHousing(result);
  ensureVendors(result);
  reconcileEntities(result);
  ensureNpcCommerce(result);
  ensureWorkshops(result);
  ensureMobileAI(result);
  ensureHarvest(result);
  ensureSuccession(result);
  ensureCaravans(result);
  ensureScavengers(result);
  ensureBurials(result);
  ensureCells(result);
  ensureInteriors(result);
  BOUNTIES.ensure(result);
  COMPANIONS.ensure(result);
  MILLING.ensure(result);
  BUSINESS.ensure(result);
  MAINTENANCE.ensure(result);
  ARMORY.ensure(result);
  ARMORER.ensure(result);
  HUNTING.ensure(result);
  return result;
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
        ![AREA_ID,COURT,VILLAGE].includes(character.area_id) ||
        !['ghost','living'].includes(character.form) ||
        !['not_started','complete','resurrected'].includes(character.opening_state) ||
        (character.opening_state === 'resurrected') !== (character.form === 'living') ||
        (character.x !== undefined && (!Number.isInteger(character.x) || character.x < 0 ||
          character.x >= (world.areas[character.area_id]?.width ?? 16))) ||
        (character.y !== undefined && (!Number.isInteger(character.y) || character.y < 0 ||
          character.y >= (world.areas[character.area_id]?.height ?? 16))) ||
        (character.facing !== undefined && !['north','south','east','west'].includes(character.facing)) ||
        (character.crystal_spent !== undefined && typeof character.crystal_spent !== 'boolean') ||
        (character.courtyard_visit_count !== undefined &&
          (!Number.isSafeInteger(character.courtyard_visit_count)||character.courtyard_visit_count<0)) ||
        (character.war_mode !== undefined && typeof character.war_mode !== 'boolean') ||
         (character.lilith_branch !== undefined &&
          !['golden','sickly'].includes(character.lilith_branch)) ||
        !Number.isSafeInteger(character.revision) || character.revision < 1 ||
        !Number.isFinite(Date.parse(character.created_at_utc)))
      throw new Error('Invalid character record in DK Server data');
    validateProgress(character);
  }
  if (world.runtime !== undefined) {
    const r = world.runtime;
    if (!r || typeof r.running !== 'boolean' || !Number.isSafeInteger(r.elapsed_ms) ||
        r.elapsed_ms < 0 || !Number.isFinite(Date.parse(r.resumed_at_utc)) ||
        new Date(Date.parse(r.resumed_at_utc)).toISOString() !== r.resumed_at_utc)
      throw new Error('Invalid persistent world runtime');
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
  if(world.areas[COURT])checkRegion(world.areas[COURT]);
  if(world.areas[VILLAGE])checkRegion(world.areas[VILLAGE]);
  if(world.living)validateLiving(world.living);
  validateSocial(world);
  validateCombat(world);
  SPAWNERS.validate(world);
  GUARDS.validate(world);
  GARRISON.validate(world);
  REFUGEES.validate(world);
  TRAFFIC.validate(world);
  validateStorage(world);
  validateEntities(world);
  validateScheduler(world);
  validateMobileAssets(world);
  validateLaw(world);
  validateDistricts(world);
  validateHousing(world);
  validateVendors(world);
  validateNpcCommerce(world);
  validateWorkshops(world);
  validateMobileAI(world);
  validateHarvest(world);
  validateSuccession(world);
  validateCaravans(world);
  validateScavengers(world);
  validateBurials(world);
  validateCells(world);
  validateInteriors(world);
  BOUNTIES.validate(world);
  COMPANIONS.validate(world);
  MILLING.validate(world);
  BUSINESS.validate(world);
  MAINTENANCE.validate(world);
  ARMORY.validate(world);
  ARMORER.validate(world);
  HUNTING.validate(world);
  return world;
}

function createCharacter(world, slot, name, now = Date.now()) {
  if (!Number.isInteger(slot) || slot !== 1) throw new Error('Invalid character slot');
  if (typeof name !== 'string' || !/^[A-Za-z0-9 _-]{1,8}$/.test(name.trim()))
    throw new Error('Character name must be 1 to 8 letters, numbers, spaces, underscores or hyphens');
  if (Object.hasOwn(world.characters, String(slot))) throw new Error('Character slot is already occupied');
  if (!Number.isFinite(now) || now < 0) throw new Error('Invalid creation timestamp');
  const character = {slot, name: name.trim().toUpperCase(), revision: 1,
    created_at_utc: new Date(now).toISOString(), area_id: AREA_ID,
    form: 'ghost', opening_state: 'not_started', x: 8, y: 12, facing: 'north', crystal_spent: false, war_mode: false};
  ensureProgress(character);
  const next = structuredClone(world);
  next.characters[String(slot)] = character;
  reconcileEntities(next);
  ARMORY.ensure(next);
  ARMORER.ensure(next);
  ensureDistricts(next);
  ensureCells(next);
  next.revision++;
  validateWorld(next);
  return {world: next, character};
}

function playableCharacter(character) {
  return { ...character, x: character.x ?? 8, y: character.y ?? 12,
    facing: character.facing ?? 'north', crystal_spent: character.crystal_spent ?? false,
     war_mode: character.war_mode === true };
}

function applyCharacterAction(world, slot, command) {
  if (slot !== 1) throw new Error('Invalid character slot');
  if (!command || typeof command !== 'object' || Array.isArray(command) ||
      !['move','finish_opening','resurrect','toggle_door','toggle_war'].includes(command.action))
    throw new Error('Invalid character action');
  const expected = command.action === 'move' ? 'action,direction' : 'action';
  if (Object.keys(command).sort().join(',') !== expected)
    throw new Error('Only valid action parameters are accepted');
  const previous = world.characters[String(slot)];
  if (!previous) throw new Error('Empty character slot');
  const next = structuredClone(world);
  const character = playableCharacter(next.characters[String(slot)]);
  const door = next.areas[AREA_ID].objects.find(o=>o.id==='temple_north_door');
  const courtyardDoor=next.areas[COURT]?.objects.find(o=>o.id==='courtyard_temple_door');
  function setDoor(open){if(door)door.open=open;if(courtyardDoor)courtyardDoor.open=open;}
  if (command.action === 'finish_opening') {
    if (character.opening_state !== 'not_started') throw new Error('Opening already completed');
    character.opening_state = 'complete';
    setDoor(true);
  } else if (command.action === 'resurrect') {
    if (character.area_id !== AREA_ID || character.form !== 'ghost' || character.opening_state !== 'complete' || character.crystal_spent)
      throw new Error('Resurrection is not available');
    if (Math.abs(character.x - 8) + Math.abs(character.y - 7) > 1)
      throw new Error('Move beside the soul crystal first');
    character.form = 'living'; character.opening_state = 'resurrected';
    character.crystal_spent = true; character.x = 8; character.y = 7;
    character.facing = 'south';
  } else if(command.action === 'toggle_war') {
     // War mode is saved with the character, not just a browser effect.
     if(character.opening_state==='not_started')throw Error('Opening ritual not complete');
     character.war_mode=!character.war_mode;
   } else if(command.action === 'toggle_door') {
    if (character.opening_state === 'not_started') throw new Error('Opening ritual not complete');
    const nearTemple = character.area_id===AREA_ID &&
      Math.abs(character.x-8)+Math.abs(character.y)<=1;
    const nearCourtyard = character.area_id===COURT &&
      Math.abs(character.x-32)+Math.abs(character.y-48)<=1;
    if(!nearTemple&&!nearCourtyard)
      throw new Error('Move beside the temple door first');
    setDoor(!door?.open);
  } else {
    if (character.opening_state === 'not_started') throw new Error('Opening ritual not complete');
    const moves = {north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]};
    if (!Object.hasOwn(moves,command.direction)) throw new Error('Invalid movement direction');
    const [dx,dy] = moves[command.direction];
    const x=character.x+dx, y=character.y+dy;
    const currentArea=next.areas[character.area_id];
    if(!currentArea||x<0||y<0||x>=currentArea.width||y>=currentArea.height)
      throw new Error('Movement blocked by the region boundary');
    const regionPortal=portal(next,character.area_id,x,y);
    if(regionPortal?.blocked)throw new Error('Movement blocked by the closed door');
    if(character.area_id===AREA_ID &&
       (currentArea.walls[y*16+x] && !(x===8 && y===0)))
      throw new Error('Movement blocked by temple walls');
    if(character.area_id!==AREA_ID && !regionPortal &&
       !traversable(currentArea,x,y,character.form))
      throw new Error('Movement blocked by walls or scenery');
    if (character.area_id===AREA_ID && character.form === 'living') {
      const solids = new Set(['altar','braziers','pillar','statue','pew','coffin','chest']);
      if (next.areas[AREA_ID].objects.some(object =>
        solids.has(object.type) && x >= object.x && y >= object.y &&
        x < object.x + (object.type === 'altar' ? 3 : object.type === 'pew' || object.type === 'coffin' ? 2 : 1) &&
        y < object.y + (object.type === 'altar' || object.type === 'statue' ? 2 : 1)))
        throw new Error('Movement blocked by a solid object');
      if (x===8 && y===0 && door && !door.open)
        throw new Error('Movement blocked by the closed door');
    }
    if (regionPortal) {
      if(character.area_id===AREA_ID&&regionPortal.area_id===COURT){
        character.courtyard_visit_count=(character.courtyard_visit_count||0)+1;
        if(character.courtyard_visit_count===1){
          character.lilith_branch=character.form==='ghost'?'golden':'sickly';
          const willow=next.areas[COURT]?.objects.find(o=>o.id==='lilith_willow');
          if(willow)willow.world_form=character.lilith_branch;
        }
      }
      character.area_id=regionPortal.area_id;
      character.x=regionPortal.x;character.y=regionPortal.y;
      character.facing=regionPortal.facing;
    } else {
      character.x=x; character.y=y; character.facing=command.direction;
    }
  }
  const concealmentEvent=command.action==='move'?FIELD.onMove(next,character):null;
  if(command.action==='toggle_door'&&character.fieldcraft){
   character.fieldcraft.hidden_until_minute=-1;
   character.fieldcraft.stealth_steps=0;
  }
  character.revision++;
  next.characters[String(slot)] = character;
  const districtEvents=onPlayerMove(next,previous);
  const cellEvents=cellMove(next,previous);
  next.revision++;
  validateWorld(next);
  return {world:next,character,events:[...(concealmentEvent?[concealmentEvent]:[]),
   ...districtEvents,...cellEvents]};
}

function worldClock(world, now = Date.now()) {
  const r = world.runtime;
  const elapsed = r ? r.elapsed_ms + (r.running ? Math.max(0, now - Date.parse(r.resumed_at_utc)) : 0)
    : Math.max(0, now - Date.parse(world.clock_anchor_utc));
  const position = elapsed % CYCLE_MS;
  const phase = position < DAY_MS ? 'day' : 'night';
  const phaseElapsed = position % DAY_MS;
  return {
    utc_now: new Date(now).toISOString(),
    clock_anchor_utc: world.clock_anchor_utc,
    phase, running: r?.running ?? true,
    cycle: Math.floor(elapsed / CYCLE_MS),
    elapsed_in_phase_seconds: Math.floor(phaseElapsed / 1000),
    seconds_until_transition: Math.ceil((DAY_MS - phaseElapsed) / 1000),
    day_real_seconds: DAY_MS / 1000,
    night_real_seconds: DAY_MS / 1000
  };
}

// Freeze world time when Stop is pressed, then continue from exactly that point
// when Start is pressed again. Old M3 saves without a runtime are accepted.
function setWorldRunning(world, running, now = Date.now()) {
  if (typeof running !== 'boolean' || !Number.isFinite(now) || now < 0)
    throw new Error('Invalid world run state');
  const next = structuredClone(world);
  const previous = next.runtime ?? {
    running: true, elapsed_ms: 0, resumed_at_utc: next.clock_anchor_utc
  };
  const elapsed = previous.elapsed_ms + (previous.running ?
    Math.max(0, now - Date.parse(previous.resumed_at_utc)) : 0);
  next.runtime = { running, elapsed_ms: Math.floor(elapsed), resumed_at_utc: new Date(now).toISOString() };
  next.revision++;
  validateWorld(next);
  return next;
}

function checkpointWorldTime(world, now = Date.now()) {
  if (!world.runtime?.running) return world;
  const next = structuredClone(world), r = next.runtime;
  r.elapsed_ms += Math.max(0, now - Date.parse(r.resumed_at_utc));
  r.resumed_at_utc = new Date(now).toISOString();
  validateWorld(next);
  return next;
}

module.exports = { COURT,VILLAGE,ensureRegions,setWorldRunning, checkpointWorldTime, playableCharacter, applyCharacterAction, AREA_ID, GRID_SIZE, TILE_SIZE, DAY_MS, CYCLE_MS, templeTemplate, makeWorld, validateWorld, createCharacter, worldClock };
