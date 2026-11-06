'use strict';
// Verify the public menu never hides Persistent World or invents a backend.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'dk-menu-server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function setup(location) {
  const els = new Map();
  function element(id) {
    if (!els.has(id)) els.set(id, {
      id, hidden: id === 'dkServerOptions', disabled: false, textContent: '',
      handlers: {},
      addEventListener(type, fn) { this.handlers[type] = fn; },
      click() { return this.handlers.click?.(); }
    });
    return els.get(id);
  }
  const optionButton = element('optionsButton');
  const document = {
    getElementById: element,
    querySelector(selector) {
      return selector === '[data-action=options]' ? optionButton : null;
    }
  };
  const window = { location, confirm: () => true };
  return { els, element, document, window, optionButton };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('public GitHub Pages always displays server controls and states hosting is absent', async () => {
  const {element,document,window} = setup({
    protocol:'https:',hostname:'dereksparks1982.github.io',origin:'https://dereksparks1982.github.io'
  });
  let requested = 0;
  vm.runInNewContext(bridge, {window,document,fetch:() => {requested++;throw Error('Should not call a nonexistent host');}});
  assert.equal(element('dkServerOptions').hidden,false);
  assert.match(element('dkServerStatus').textContent,/NOT CONNECTED/);
  assert.match(element('dkServerClock').textContent,/unavailable/);
  assert.equal(element('dkServerStop').disabled,true);
  assert.equal(element('dkServerStart').disabled,false);
  assert.equal(window.DemonKillerServer,undefined);
  await element('dkServerStart').click();
  assert.match(element('dkServerStatus').textContent,/CANNOT START/);
  assert.match(element('dkServerHelp').textContent,/GitHub Pages cannot launch/);
  assert.equal(requested,0,'No fake server calls are allowed from GitHub Pages');
});

test('local running DK Server is detected and can be stopped from Options', async () => {
  const {element,document,window} = setup({
    protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:8766'
  });
  const calls=[];
  const fetch=async(route,opts={})=>{
    calls.push({route,opts});
    return {ok:true,status:200,async json(){
      if(route==='/api/v1/health')return {build:'local-m5',online:true};
      if(route==='/api/v1/clock')return {phase:'day',running:true,seconds_until_transition:1200};
      if(route==='/api/v1/server/stop')return {running:false};
      throw Error('Unexpected route '+route);
    }};
  };
  vm.runInNewContext(bridge, {window,document,fetch});
  await tick();
  assert.equal(element('dkServerOptions').hidden,false);
  assert.match(element('dkServerStatus').textContent,/RUNNING/);
  assert.match(element('dkServerClock').textContent,/DAY/);
  assert.equal(element('dkServerStart').disabled,true);
  assert.equal(element('dkServerStop').disabled,false);
  await element('dkServerStop').click();
  assert.match(element('dkServerStatus').textContent,/RUNNING|PAUSED/);
  assert.equal(calls.at(-1).route,'/api/v1/clock');
  assert(calls.some(call=>call.route==='/api/v1/server/stop'));
  assert(calls.some(call=>call.route==='/api/v1/server/stop'&&call.opts.headers['X-DK-Control']==='stop'&&call.opts.method==='POST'));
});

test('main menu exposes Start, Stop, clock and one life without hiding the world section',()=>{
  for(const id of ['dkServerOptions','dkServerStart','dkServerStop','dkServerClock','dkServerRefresh'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.doesNotMatch(html,/id="dkServerOptions" hidden/);
  assert.match(html,/One character\. One life\./);
  assert.match(html,/for\(let i=0;i<1;i\+\+\)/);
  assert.match(html,/mode==='new'&&Boolean\(s\)/);
});
