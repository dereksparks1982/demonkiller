/* Demon Killer world controls: visible on both the website and local host.
 * GitHub Pages is a static preview; never fake a running world process.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const page = window.location || {};
  const isLocal = page.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(page.hostname);
  const panel = $('dkServerOptions');
  if (panel) panel.hidden = false;

  async function request(route, options = {}) {
    const response = await fetch(route, {
      credentials: 'same-origin', cache: 'no-store', ...options
    });
    let payload;
    try { payload = await response.json(); }
    catch (_) { throw Error('DK Server did not return a valid response'); }
    if (!response.ok) throw Error(payload.error || 'DK Server error ' + response.status);
    return payload;
  }
  const post = (route, data) => request(route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  // Only the loopback-served game currently has an API. The public website
  // must not send server-control commands to an imaginary or unsafe host.
  const client = isLocal ? Object.freeze({
    async listCharacters() { return (await request('/api/v1/characters')).characters; },
    async createCharacter(slot, name) { return (await post('/api/v1/characters', {slot, name})).character; },
    async deleteCharacter(slot,name) {
      return request('/api/v1/characters/' + slot, {
        method:'DELETE',headers:{'Content-Type':'application/json','X-DK-Control':'delete-character'},
        body:JSON.stringify({name,confirm:'DELETE'})
      });
    },
    async getCharacter(slot) { return (await request('/api/v1/characters/' + slot)).character; },
    async action(slot, action, fields = {}) {
      return (await post('/api/v1/characters/' + slot + '/actions', {action, ...fields})).character;
    },
    async health() { return request('/api/v1/health'); },
    async saveStatus() { return request('/api/v1/save/status'); },
    async resetWorld(expected_revision) {
      return request('/api/v1/save/reset-world',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-DK-Control':'reset-world'},
        body:JSON.stringify({confirm:'RESET WORLD',expected_revision})
      });
    },
    async checkpoint() {
      return request('/api/v1/save/checkpoint', {
        method:'POST',headers:{'X-DK-Control':'checkpoint'}
      });
    },
    async serverState() { return request('/api/v1/server/state'); },
    async startWorld() {
      return request('/api/v1/server/start', {
        method:'POST', headers:{'X-DK-Control':'start'}
      });
    },
    async stopWorld() {
      return request('/api/v1/server/stop', {
        method:'POST', headers:{'X-DK-Control':'stop'}
      });
    },
    async clock() { return request('/api/v1/clock'); },
    async regions() { return request('/api/v1/areas'); },
    async area(id) { return request('/api/v1/areas/' + encodeURIComponent(id)); },
    async outdoorInfo(id) {
      return request('/api/v1/architect/outdoors?area_id='+encodeURIComponent(id));
    },
    async exportOutdoor(id) {
      return request('/api/v1/architect/outdoors/export?area_id='+encodeURIComponent(id));
    },
    async editOutdoor(action,area_id,expected_revision,fields={}) {
      return request('/api/v1/architect/outdoors/edit',{
        method:'POST',headers:{'Content-Type':'application/json','X-DK-Architect':'outdoors'},
        body:JSON.stringify({action,area_id,expected_revision,...fields})
      });
    },
    async living() { return request('/api/v1/living'); },
    async events(after=0) { return request('/api/v1/living/events?after='+after); },
    async gameplay() { return request('/api/v1/gameplay'); },
    async skills() { return request('/api/v1/skills'); },
    async law() { return request('/api/v1/law'); },
    async items() { return request('/api/v1/entities/items'); },
    async inventory() { return request('/api/v1/inventory'); },
    async schedule() { return request('/api/v1/schedule'); },
    async region() { return request('/api/v1/region/current'); },
    async housing() { return request('/api/v1/housing'); },
    async vendors() { return request('/api/v1/vendors'); },
    async npcCommerce() { return request('/api/v1/npc-commerce'); },
    async workshops() { return request('/api/v1/workshops'); },
    async npcAI() { return request('/api/v1/npc-ai'); },
    async npcHarvest() { return request('/api/v1/npc-harvest'); },
    async npcSuccession() { return request('/api/v1/npc-succession'); },
    async caravans() { return request('/api/v1/caravans'); },
    async corpses() { return request('/api/v1/corpses'); },
    async nearby(radius=8) { return request('/api/v1/nearby?radius='+encodeURIComponent(radius)); },
    async sectorInterest(cursor=null,radius=24){
      const url='/api/v1/sectors/interest?radius='+encodeURIComponent(radius)+
        (cursor?'&cursor='+encodeURIComponent(cursor):'');
      return request(url);
    },
    async streamingCells(radius=24){
      return request('/api/v1/streaming-cells?radius='+encodeURIComponent(radius));
    },
    async interiorCells(){
      return request('/api/v1/architect/interiors');
    },
    async interiorDraft(cell_id){
      return request('/api/v1/architect/interiors/draft?cell_id='+encodeURIComponent(cell_id));
    },
    async editInteriorDraft(action,cell_id,expected_revision,fields={}){
      return request('/api/v1/architect/interiors/draft',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-DK-Architect':'draft'},
        body:JSON.stringify({action,cell_id,expected_revision,...fields})
      });
    },
    async cellContents(cursor=null,radius=24){
      const url='/api/v1/streaming-cells/contents?radius='+encodeURIComponent(radius)+
        (cursor?'&cursor='+encodeURIComponent(cursor):'');
      return request(url);
    },
    async sectorManifest(area){
      return request('/api/v1/sectors/manifest?area='+encodeURIComponent(area));
    },
    async sectorChunk(area,sx,sy){
      return request('/api/v1/sectors/chunk?area='+encodeURIComponent(area)+
        '&sx='+encodeURIComponent(sx)+'&sy='+encodeURIComponent(sy));
    },
    async social() { return request('/api/v1/social'); },
    async socialAction(action,fields={}) { return post('/api/v1/social',{action,...fields}); },
    async gameAction(action,fields={}) {
      return post('/api/v1/gameplay',{action,...fields});
    },
    async bankBox() { return request('/api/v1/bank/box'); },
    async collectLetter(letter_id) { return post('/api/v1/bank/collect',{letter_id}); },
    async world() { return request('/api/v1/world'); },
    async shutdown() {
      return request('/api/v1/server/shutdown', {
        method: 'POST', headers: {'X-DK-Control': 'shutdown'}
      });
    }
  }) : null;
  if (client) window.DemonKillerServer = client;
  if (!panel) return; // The temple uses the same local API without the menu.

  const status = $('dkServerStatus'), clock = $('dkServerClock');
  const start = $('dkServerStart'), stop = $('dkServerStop');
  const refreshButton = $('dkServerRefresh'), help = $('dkServerHelp');
  const checkpoint = $('dkServerCheckpoint'), backupStatus = $('dkServerSaveStatus');

  function showOffline(details) {
    status.textContent = details;
    clock.textContent = 'World time: unavailable';
    start.disabled = false;
    stop.disabled = true;
    checkpoint.disabled = true;
    backupStatus.textContent='Verified world backups: not connected';
  }
  async function refresh() {
    if (!client) {
      showOffline('NOT CONNECTED · No hosted DK Server is linked to this website.');
      help.textContent =
        'This is the GitHub Pages preview. Its host cannot run a persistent world. ' +
        'Start/Stop will operate when a separately hosted world service is connected.';
      return;
    }
    try {
      const [health, worldClock, saves] = await Promise.all([client.health(), client.clock(), client.saveStatus()]);
      if(!/^local-m[0-9]+$/.test(health.build||'') || Number(health.build.slice(7))<35) throw Error('DK Server needs M35 or later');
      status.textContent = worldClock.running
        ? 'RUNNING · DK Server is connected and world time is advancing'
        : 'PAUSED · DK Server is connected; the world is frozen';
      clock.textContent = 'World time: ' + worldClock.phase.toUpperCase() +
        ' · ' + Math.ceil(worldClock.seconds_until_transition / 60) +
        ' minutes until ' + (worldClock.phase === 'day' ? 'night' : 'day');
      help.textContent = 'Closing the browser leaves an active world running. ' +
        'Stop Server saves and pauses its clock; Start Server resumes the world.';
      start.disabled = !!worldClock.running;
      stop.disabled = !worldClock.running;
      checkpoint.disabled = false;
      backupStatus.textContent = 'Verified world backups: '+saves.backup_count+
        ' · Saved revision '+saves.primary.revision+
        (saves.invalid_backups?' · '+saves.invalid_backups+' invalid backups':'')+
        (saves.last_backup_error?' · BACKUP ERROR':'');
    } catch (error) {
      showOffline('NOT CONNECTED · ' + error.message);
      help.textContent = 'DK Server is unavailable at this game address.';
    }
  }
  start.addEventListener('click', async () => {
    if (!client) {
      showOffline('CANNOT START · No persistent server has been deployed for the website.');
      help.textContent = 'GitHub Pages cannot launch a server. ' +
        'A hosted DK Server and a secure control service are required.';
      return;
    }
    start.disabled = true;
    try {
      await client.startWorld();
      await refresh();
    } catch(error) {
      status.textContent = 'CANNOT START · ' + error.message;
      start.disabled = false;
    }
  });
  stop.addEventListener('click', async () => {
    if (!client || stop.disabled) return;
    if (!window.confirm('Pause the world and save its current state?')) return;
    stop.disabled = true;
    try {
      await client.stopWorld();
      await refresh();
    } catch (error) {
      status.textContent = 'PAUSE FAILED · ' + error.message;
      stop.disabled = false;
    }
  });
  checkpoint.addEventListener('click',async()=>{
    if(!client||checkpoint.disabled)return;
    checkpoint.disabled=true;
    try{await client.checkpoint();await refresh();}
    catch(e){backupStatus.textContent='World checkpoint failed: '+e.message;checkpoint.disabled=false;}
  });
  refreshButton.addEventListener('click', refresh);
  document.querySelector('[data-action=options]')?.addEventListener('click', refresh);
  refresh();
})();
