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
    async getCharacter(slot) { return (await request('/api/v1/characters/' + slot)).character; },
    async action(slot, action, fields = {}) {
      return (await post('/api/v1/characters/' + slot + '/actions', {action, ...fields})).character;
    },
    async health() { return request('/api/v1/health'); },
    async clock() { return request('/api/v1/clock'); },
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

  function showOffline(details) {
    status.textContent = details;
    clock.textContent = 'World time: unavailable';
    start.disabled = false;
    stop.disabled = true;
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
      const [health, worldClock] = await Promise.all([client.health(), client.clock()]);
      if (health.build !== 'local-m3') throw Error('Incompatible DK Server version');
      status.textContent = 'RUNNING · DK Server is connected';
      clock.textContent = 'World time: ' + worldClock.phase.toUpperCase() +
        ' · ' + Math.ceil(worldClock.seconds_until_transition / 60) +
        ' minutes until ' + (worldClock.phase === 'day' ? 'night' : 'day');
      help.textContent = 'Closing the browser leaves the world running. ' +
        'Stop Server saves pending changes and ends the local world process.';
      start.disabled = true;
      stop.disabled = false;
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
    await refresh();
    if (!stop.disabled) status.textContent = 'RUNNING · DK Server is already started';
    else status.textContent = 'CANNOT START · The server host must start the process';
  });
  stop.addEventListener('click', async () => {
    if (!client || stop.disabled) return;
    if (!window.confirm('Stop DK Server and pause the persistent world?')) return;
    stop.disabled = true;
    try {
      await client.shutdown();
      status.textContent = 'STOPPING · DK Server is saving pending world writes';
      clock.textContent = 'World time: stopping';
      start.disabled = false;
    } catch (error) {
      status.textContent = 'STOP FAILED · ' + error.message;
      stop.disabled = false;
    }
  });
  refreshButton.addEventListener('click', refresh);
  document.querySelector('[data-action=options]')?.addEventListener('click', refresh);
  refresh();
})();
