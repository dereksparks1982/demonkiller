'use strict';
// Browser-like simulated integration: no browser, external engine or extra packages.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('test-center.html');
assert(html.includes('cult-system.js')&&html.includes('cult-journal.css'),'Cult files must load in temple');
assert(html.includes('citizen-population.js')&&html.includes('cult-network.js'),
 'Population and hierarchy modules must load in the temple');
for(const id of ['cultJournalToggle','cultNetwork','cultNodeDetails','cultMasterCard',
 'cultLooseLeads','cultBranch_faith','cultBranch_law','cultBranch_wealth','cultBranch_shadows'])
 assert(html.includes('id="'+id+'"'),'Missing cult board control '+id);
assert(!html.includes('SOCIETY REGISTER'),'Public population must not be displayed as the cult');
const moduleCode=read('cult-system.js'),populationCode=read('citizen-population.js'),
 networkCode=read('cult-network.js'),gameCode=read('test-center.js');
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
  vm.runInContext(networkCode,context,{filename:'cult-network.js',timeout:3000});
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
assert.match(first.get('cultNetworkStatus').textContent,/0 IDENTIFIED/);
assert.equal(first.get('cultLooseLeads').children.length,1,'No unverified leads initially');
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
assert.equal(first.get('cultLooseLeads').children.length,1,'Suspects stay outside confirmed hierarchy');
assert.equal(first.get('cultLooseLeads').children[0].children[0].textContent,'Citizen Doctor');
assert.throws(()=>hook.evidence('doctor',{id:'false',kind:'membership',title:'Unfounded accusation'}));
hook.evidence('doctor',{id:'alibi',kind:'innocence',title:'An alibi'});
assert.equal(hook.dossier('doctor').affiliation,'cleared');
assert.equal(hook.board().length,0,'Exonerated citizen leaves suspected list');
saved=JSON.parse(store.get('dkSoftworks.demonkiller.characters.v1'));
assert.equal(saved.slots[0].cultWorld.knowledge.doctor.evidence.length,2);
const second=load();
assert.equal(second.window.DemonKillerCultHooks.dossier('doctor').affiliation,'cleared',
  'Continue must preserve investigation history');
assert.match(second.get('cultNetworkStatus').textContent,/0 IDENTIFIED/,
 'Continue does not reveal hidden cultists without evidence');
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
assert.equal(second.get('cultMasterCard').events.click.length,1);
second.get('cultMasterCard').emit('click');
assert.match(second.get('cultNodeDetails').children[0].textContent,/UNKNOWN LEADER/,
 'Center of network must remain a locked mystery');
assert.equal(population.publicRecord('citizen_magistrate').occupation,'Magistrate');
assert.equal(population.schedule('citizen_magistrate').activity,'working');
assert.equal(population.encounter('citizen_magistrate').affiliation,'unknown',
 'Meeting prominent citizen does not reveal cult membership');
assert.match(second.get('cultNetworkStatus').textContent,/0 IDENTIFIED/,
 'Meeting a prominent citizen does not reveal them as a cultist');
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
 'Population must not overwrite Architect layout storage');
const world=JSON.parse(store.get('dkSoftworks.demonkiller.characters.v1')).slots[0].cultWorld;
const member=Object.values(world.citizens).find(p=>p.active&&p.id!=='temple_ritualist');
assert(member,'Need a genuine seeded cultist for the integration test');
const cult=third.window.DemonKillerCultHooks;
assert.equal(cult.dossier(member.id),null,'Member starts unknown');
cult.meet(member.id);
assert.equal(cult.dossier(member.id).affiliation,'unknown');
assert.match(third.get('cultNetworkStatus').textContent,/0 IDENTIFIED/,
 'Meeting a member never reveals their secret cult status');
cult.evidence(member.id,{id:'letter-proof',kind:'membership',
 title:'A recovered symbol',source:'Sealed letter'});
assert.match(third.get('cultNetworkStatus').textContent,/1 IDENTIFIED/);
const branch=third.context.DemonKillerCultNetwork.branchOf(member);
const card=third.get('cultBranch_'+branch).children.find(el=>
 el.children?.some(child=>child.textContent===member.name));
assert(card,'Confirmed member appears by name in their cult branch');
card.emit('click');
const details=third.get('cultNodeDetails').children;
assert.equal(details[0].textContent,member.name,'Selected cult card shows confirmed name');
assert(details.some(el=>el.textContent.includes('A recovered symbol')),
 'Confirmed evidence appears on the chosen card');
const track=details.find(el=>el.textContent==='MARK FOR TRACKING');
assert(track,'Can mark an identified cultist for tracking');
track.emit('click');
const savedTrack=JSON.parse(store.get('dkSoftworks.demonkiller.characters.v1')).slots[0];
assert.equal(savedTrack.cultWorld.trackedCultistId,member.id);
const fourth=load();
const restoredCard=fourth.get('cultBranch_'+branch).children.find(el=>
 el.children?.some(child=>child.textContent===member.name));
assert(restoredCard.className.includes('cult-tracked'),
 'Tracking survives reload of named character');
fourth.window.DemonKillerCultHooks.kill(member.id);
assert(fourth.get('cultBranch_'+branch).children.some(node=>
 node.className.includes('cult-eliminated')&&
 node.children.some(c=>c.textContent===member.name)),
 'Eliminated known member remains visible on the cult board');
console.log('PASS: masked hierarchy, real proof, false suspects, tracking, deaths, named saves and Architect preservation.');
