'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const events = new EventSource('/api/v1/events');
  function paintClock(clock) {
    byId('phase').textContent = clock.phase === 'day' ? 'Day' : 'Night';
    byId('next').textContent = String(clock.seconds_until_transition);
  }
  events.addEventListener('world.snapshot', event => {
    const data = JSON.parse(event.data);
    byId('world').textContent = data.world_id;
    byId('area').textContent = data.area.area_id + ' (' + data.area.width + ' × ' + data.area.height + ')';
    paintClock(data.clock);
    byId('connection').textContent = 'Connected (world monitor).';
  });
  events.addEventListener('world.clock', event => paintClock(JSON.parse(event.data)));
  events.onerror = () => { byId('connection').textContent = 'Connection lost; waiting to reconnect.'; };
  window.addEventListener('pagehide', () => events.close());
})();
