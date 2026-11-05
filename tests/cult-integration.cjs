'use strict';
// Browser-like simulated integration: no browser, external engine or extra packages.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('test-center.html');
assert(html.includes('cult-system.js')&&html.includes('cult-journal.css'),'Cult files must load in temple');
assert(html.includes('citizen-population.js')&&html.includes('id="cultRegistryCards"'),
 'Population simulation and public register must load in the temple');
assert(html.includes('id="cultJournalToggle"')&&html.includes('id="cultJournalCards"'));
const moduleCode=read('cult-system.js'),populationCode=read('citizen-population.js'),
 gameCode=read('test-center.js');
const noop=()=>{};
const graphics={fillRect:noop,strokeRect:noop,clearRect:noop,beginPath:noop,
  moveTo:noop,lineTo:noop,stroke:noop,save:noop,restore:noop,
  translate:noop,rotate:noop,scale:noop,drawImage:noop};
class Element{
  constructor(id){this.id=id;this.textContent='';this.value='';this.files=[];
    this.children=[];this.style={};this.hidden=id==='cultJournal';
    this.selectedOptions=[{textContent:id}];this.classList={toggle:noop};this.events={};}
  addEventListener(n,fn){(this.events[n]??=[]).push(fn);}
  emit(n,e={}){for(const fn of this.events[n]||[])fn(e);}
  setAttribute(n,v){this[n]=v;}
  append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];}
  getContext(){return graphics;}
  getBoundingClientRect(){return {left:0,top:0,width:512,height:512};}
  focus(){}remove(){}click(){}
}
const store=new Map();
store.set('dkSoftworks.demonkiller.activeCharacter.v1','1');
store.set('dkSoftworks.demonkiller.characters.v1',JSON.stringify({version:1,slots:[
  {id:1,name:'TEST',scene:null,updated:1000,worldSeed:'fixed-test-seed'},null,null]}));
function load(){
  const elems={},events={},localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};
  const get=id=>elems[id]??(elems[id]=new Element(id));
  const document={getElementById:get,createElement:n=>new Element(n),
    addEventListener:(n,fn)=>(events[n]??=[]).push(fn),body:new Element('body')};
  const window={addEventListener:noop};
  const env={document,localStorage,window,Blob,URL,Date,setTimeout,console};
  const context=vm.createContext(env);
  vm.runInContext(moduleCode,context,{filename:'cult-system.js',timeout:3000});
  vm.runInContext(populationCode,context,{filename:'citizen-population.js',timeout:3000});
  vm.runInContext(gameCode,context,{filename:'test-center.js',timeout:3000});
  return {get,window,context};
}
const first=load();
let saved=JSON.parse(store.get('dkSoftworks.demonkiller.characters.v1'));
assert.equal(saved.slots[0].cultWorld.seed,'fixed-test-seed');
assert.equal(saved.slots[0].cultWorld.citizens.temple_ritualist.active,true);
assert.equal(saved.slots[0].populationWorld.order.length,24,'New world must include 24 civilians');
assert.equal(Object.keys(saved.slots[0].cultWorld.citizens).length,25,
 'Population registered in cult system without replacing the ritualist');
assert.equal(first.get('cultJournalCards').children.length,0,'Hidden cult truth must not create cards');
assert.equal(store.has('dkSoftworks.demonkiller.testCenter.v1'),false,'Cult init must not overwrite DK Architect save');
first.get('cultJournalToggle').emit('click');
assert.equal(first.get('cultJournal').hidden,false,'Journal button opens the overlay');
first.get('cultJournalClose').emit('click');
assert.equal(first.get('cultJournal').hidden,true,'Close button dismisses journal');
const hook=first.window.DemonKillerCultHooks;
assert(hook,'Cult event bridge must be available to future NPC scenes');
hook.registerCitizen({id:'doctor',name:'Citizen Doctor',occupation:'Physician',eligible:false,
  prominent:true,traits:{ambition:.2,greed:.1}});
assert.equal(hook.dossier('doctor'),null,'Registered NPC is not automatically encountered');
hook.meet('doctor');
assert.equal(hook.dossier('doctor').affiliation,'unknown','Meeting does not reveal cult status');
hook.evidence('doctor',{id:'suspicion',kind:'suspicion',title:'A suspicious evening visit'});
assert.equal(hook.board().length,1,'Suspicion adds a lead to the board');
assert.equal(first.get('cultJournalCards').children.length,1,'A known character has a dossier card');
assert.throws(()=>hook.evidence('doctor',{id:'false',kind:'membership',title:'Unfounded accusation'}));
hook.evidence('doctor',{id:'alibi',kind:'innocence',title:'An alibi'});
assert.equal(hook.dossier('doctor').affiliation,'cleared');
assert.equal(hook.board().length,0,'Exonerated citizen leaves suspected list');
saved=JSON.parse(store.get('dkSoftworks.demonkiller.characters.v1'));
assert.equal(saved.slots[0].cultWorld.knowledge.doctor.evidence.length,2);
const second=load();
assert.equal(second.window.DemonKillerCultHooks.dossier('doctor').affiliation,'cleared',
  'Continue must preserve investigation history');
assert.equal(second.get('cultJournalCards').children.length,1,
  'Continue must restore public dossier cards without revealing additional secrets');
assert.equal(second.window.DemonKillerCultHooks.dossier('temple_ritualist'),null,
  'The cult ritualist must not be revealed automatically');
const original=second.window.DemonKillerCultHooks.dossier('doctor');
assert.equal(original.evidence.length,2);
const population=second.window.DemonKillerPopulationHooks;
assert(population,'Population event bridge must be available to future NPC scenes');
const register=population.publicRegister();
assert.equal(register.length,24);
assert(register.every(person=>!Object.hasOwn(person,'active')&&!Object.hasOwn(person,'traits')),
 'Public register must never reveal private character or cult attributes');
assert.equal(population.currentTime().hour,9,'Initial population clock should have a deterministic start');
second.get('cultRegistryTab').emit('click');
assert.equal(second.get('cultRegistryPane').hidden,false,'Society Register tab must open');
assert.equal(second.get('cultDossierPane').hidden,true,'Register hides dossiers without changing them');
assert.equal(second.get('cultRegistryCards').children.length,24,'All 24 civilian public records appear');
second.get('cultDossierTab').emit('click');
assert.equal(second.get('cultDossierPane').hidden,false,'Can return to discovered dossiers');
assert.equal(population.publicRecord('citizen_magistrate').occupation,'Magistrate');
assert.equal(population.schedule('citizen_magistrate').activity,'working');
assert.equal(population.encounter('citizen_magistrate').affiliation,'unknown',
 'Meeting prominent citizen does not reveal cult membership');
assert.equal(second.get('cultJournalCards').children.length,2,
 'Encountered citizen joins existing public dossiers');
assert.equal(population.advanceHours(12).hour,21);
assert.notEqual(population.schedule('citizen_magistrate').activity,'working',
 'Citizen schedule responds to population time');
const third=load();
assert.equal(third.window.DemonKillerPopulationHooks.currentTime().hour,21,
 'Continue preserves the population clock and work shifts');
assert.equal(third.window.DemonKillerPopulationHooks.publicRegister().length,24,
 'Continue preserves the society roster');
assert.equal(third.window.DemonKillerCultHooks.dossier('citizen_magistrate').affiliation,'unknown',
 'Continue does not reveal hidden citizen allegiances');
assert.equal(third.window.DemonKillerCultHooks.dossier('doctor').affiliation,'cleared',
 'Continuing must preserve all prior investigation history');
assert.equal(store.has('dkSoftworks.demonkiller.testCenter.v1'),false,
 'No population work may overwrite DK Architect layout storage');
console.log('PASS: named saves, 24 hidden citizens, public register, time, encounters, clues, Continue, unaffected Architect save.');
