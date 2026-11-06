'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let creatingSlot = 0;
  const status = value => { $('serverStatus').textContent = value; };
  const show = (id, enabled) => { $(id).hidden = !enabled; };
  async function request(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('DK Server returned an invalid response'); }
    if (!response.ok) throw new Error(data.error || 'DK Server request failed (' + response.status + ')');
    return data;
  }
  const json = value => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  function error(e) { status('Error: ' + (e?.message || 'Unknown DK Server error')); }
  async function initialize() {
    const info = await request('/api/v1/auth/status');
    show('accessPanel', !info.authenticated);
    show('charactersPanel', info.authenticated);
    if (!info.authenticated) {
      const setup = info.setup_required;
      $('accessHeading').textContent = setup ? 'SET UP DK SERVER OWNER' : 'OWNER SIGN-IN';
      $('accessSubmit').textContent = setup ? 'CREATE OWNER PASSWORD' : 'SIGN IN';
      $('accessHelp').textContent = setup ? 'First local setup: choose a password with at least 12 characters. No browser save files will be imported.' : 'Enter the password set up on this DK Server.';
      $('ownerPassword').autocomplete = setup ? 'new-password' : 'current-password';
      status(setup ? 'DK Server is ready for owner setup.' : 'Sign in to see server-owned characters.');
    } else {
      await loadSlots();
    }
    return info;
  }
  async function loadSlots() {
    const data = await request('/api/v1/characters');
    const root = $('slots'); root.replaceChildren();
    for (let number = 1; number <= 3; number++) {
      const saved = data.characters[String(number)];
      const row = document.createElement('div');row.className = 'slot';
      const caption = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = 'RECORD 0' + number + ': ' + (saved ? saved.name : 'EMPTY');
      caption.append(heading);
      if (saved) {
        const details = document.createElement('small');
        details.textContent = saved.form.toUpperCase() + ' · ' + saved.area_id;
        caption.append(details);
      }
      const button = document.createElement('button');button.type = 'button';
      button.textContent = saved ? 'CONTINUE' : 'NEW GAME';
      button.addEventListener('click', () => saved ? selectRecord(number) : newRecord(number));
      row.append(caption,button);root.append(row);
    }
    status('Connected. Character records loaded from DK Server, revision ' + data.world_revision + '.');
  }
  function newRecord(slot) {
    creatingSlot = slot;
    $('newHeading').textContent = 'CREATE CHARACTER IN RECORD 0' + slot;
    $('characterName').value = '';
    show('selectedPanel', false);
    show('createPanel', true);
    $('characterName').focus();
  }
  async function selectRecord(slot) {
    try {
      const { character } = await request('/api/v1/characters/' + slot);
      $('selectedRecord').textContent = character.name + ' · ' + character.form + ' · ' + character.area_id;
      show('createPanel', false);
      show('selectedPanel', true);
      status('Continue loaded from DK Server: ' + character.name + '.');
    } catch (e) { error(e); }
  }
  $('accessForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('accessSubmit');submit.disabled = true;
    try {
      const info = await request('/api/v1/auth/status');
      await request(info.setup_required ? '/api/v1/auth/setup' : '/api/v1/auth/login', json({password:$('ownerPassword').value}));
      $('ownerPassword').value='';
      await initialize();
    } catch (e) { error(e); }
    finally { submit.disabled = false; }
  });
  $('createForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('createForm').querySelector('[type=submit]'); submit.disabled = true;
    try {
      const { character } = await request('/api/v1/characters', json({slot:creatingSlot,name:$('characterName').value}));
      show('createPanel', false);
      await loadSlots();
      await selectRecord(character.slot);
    } catch (e) { error(e); }
    finally { submit.disabled = false; }
  });
  $('cancel').addEventListener('click', () => show('createPanel', false));
  $('logout').addEventListener('click', async () => {
    try { await request('/api/v1/auth/logout', {method:'POST'}); show('selectedPanel', false); await initialize(); }
    catch (e) { error(e); }
  });
  initialize().catch(error);
})();
