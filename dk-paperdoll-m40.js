/* DK Softworks M40: one UO Classic-style paper-doll menu in both regions.
 * Paper doll never destroys saves. Destructive operations live in OPTIONS.
 * Not-yet-implemented guild and war engines stay visibly unavailable.
 */
(function(){
'use strict';
const temple=Boolean(document.getElementById('templePaper'));
const paper=document.getElementById(temple?'templePaper':'paperDoll');
if(!paper)return;
const $=id=>document.getElementById(id);
paper.classList.add('dk-paper-extended');
const nav=document.createElement('nav');
nav.className='dk-paper-actions';
nav.setAttribute('aria-label','Classic paper-doll commands');
const card=document.createElement('section');
card.className='dk-paper-card';card.hidden=true;card.setAttribute('role','dialog');
card.setAttribute('aria-label','Paper-doll information');
const head=document.createElement('header'),heading=document.createElement('strong'),
 close=document.createElement('button'),content=document.createElement('div');
close.type='button';close.textContent='×';close.title='Close';close.setAttribute('aria-label','Close information panel');
head.append(heading,close);content.className='dk-paper-card-body';
card.append(head,content);
document.body.append(card);paper.append(nav);
close.addEventListener('click',()=>{card.hidden=true;});
const journal=[];
function entry(message){
 const text=String(message||'').trim();
 if(text&&text!==journal.at(-1)){
  journal.push(text);if(journal.length>80)journal.shift();
 }
}
const logIds=temple?['status','hint']:['hudJournal','message'];
for(const id of logIds){
 const node=$(id);if(!node)continue;
 entry(node.textContent);
 new MutationObserver(()=>entry(node.textContent)).observe(node,
  {childList:true,subtree:true,characterData:true});
}
const connected=()=>Boolean(window.DemonKillerServer&&
 new URLSearchParams(location.search).has('dkSlot'));
function localCharacter(){
 if(!temple)return window.DKOutdoorState?.()?.player||{};
 try{
  const data=JSON.parse(localStorage.getItem('dkSoftworks.demonkiller.characters.v1')||'null');
  const player=data?.slots?.[0];
  const life=$('lifeState')?.textContent?.includes('GHOST')?'ghost':null;
  return {name:player?.name||'ADVENTURER',
   ...(player?.scene?.player||{}),form:life||player?.scene?.player?.form||'ghost'};
 }catch(_){return {name:'ADVENTURER',form:'ghost'};}
}
async function character(){
 if(connected()){
  try{return await window.DemonKillerServer.getCharacter(1);}
  catch(error){entry('DK Server character data unavailable: '+error.message);}
 }
 return localCharacter();
}
function show(title,body){
 heading.textContent=title;content.replaceChildren();
 const lines=Array.isArray(body)?body:[body];
 for(const item of lines){
  const p=document.createElement('p');p.textContent=String(item);content.append(p);
 }
 card.hidden=false;
 const r=paper.getBoundingClientRect(),width=Math.min(344,window.innerWidth-20);
 card.style.width=width+'px';
 card.style.left=Math.max(8,Math.min(window.innerWidth-width-8,r.right+10))+'px';
 card.style.top=Math.max(8,Math.min(window.innerHeight-135,r.top+10))+'px';
}
function menu(label,onClick,description='',enabled=true){
 const button=document.createElement('button');button.type='button';
 button.textContent=label;button.title=description||label;
 button.disabled=!enabled;
 if(!enabled)button.setAttribute('aria-description',description+' (not implemented)');
 button.addEventListener('click',onClick);
 nav.append(button);return button;
}
menu('HELP',()=>{
 show('HELP',[
  'Hold RIGHT MOUSE to walk toward the pointer; release to stop.',
  'LEFT CLICK examines an object. DOUBLE-CLICK uses it. P opens the paper doll; I opens the backpack.',
  'Temple: double-click the crystal to return to life. F8 opens DK Architect, where editing is allowed.',
  'Only the real DK Server continues world simulation while you are away.'
 ]);
},'Open movement, interaction and game help');
menu('OPTIONS',()=>{location.href='./index.html?view=options';},
 'Open Options and Save Management at the main menu');
menu('LOG OUT',()=>{
 if(!window.confirm('Log out to the main menu? Your character is preserved; a running world server continues without you.'))return;
 location.href='./index.html';
},'Return to the menu; keep character and running world');
menu('JOURNAL',async()=>{
 const recent=[...journal];
 if(connected()){
  try{
   const result=await window.DemonKillerServer.events(0);
   for(const item of (result.events||[]).slice(-24))
    if(item.text)recent.push(item.text);
  }catch(_){}
 }
 show('JOURNAL',recent.length?recent.slice(-50):['Nothing has been recorded this session yet.']);
},'Open recorded messages and nearby world events');
menu('SKILLS',async()=>{
 const p=await character();
 let skills=p.skills||{};
 if(connected()){
  try{const result=await window.DemonKillerServer.skills();skills=result.skills||skills;}
  catch(error){show('SKILLS',['Could not load skill records: '+error.message]);return;}
 }
 const rows=Object.entries(skills).sort(([a],[b])=>a.localeCompare(b))
  .map(([key,v])=>key.toUpperCase()+' · '+
   (v&&typeof v==='object'?((v.value||0)/10).toFixed(1)+(v.lock?' · '+v.lock.toUpperCase():''):
    String(v)));
 show('SKILLS',rows.length?rows:['The character has no recorded skills yet.']);
},'Open character skills');
menu('GUILD',()=>{},'Guild creation and membership are not implemented yet',false);
menu('QUESTS',()=>{},'Quest journal is not implemented yet',false);
menu('PEACE / WAR',()=>{},'Combat stance is not implemented by the server yet',false);
menu('STATUS',async()=>{
 const p=await character(),s=p.crafting||{};
 show('STATUS',[
  'NAME · '+(p.name||'ADVENTURER'),
  'FORM · '+(p.form||'ghost').toUpperCase(),
  'HEALTH · '+(s.health??'unknown')+'  ENERGY · '+(s.energy??'unknown'),
  'HUNGER · '+(s.hunger??'unknown'),
  'GOLD · '+(p.gold??0)+'  BANK · '+(p.bank_gold??0),
  'LOCATION · '+(p.area_id||'Temple')+(Number.isInteger(p.x)?' ('+p.x+', '+p.y+')':'')
 ]);
},'Show real character condition and equipment');
menu('BACKPACK',()=>{
 const bag=$(temple?'templeBag':'backpack');if(!bag)return;
 bag.hidden=false;bag.style.zIndex='47';
},'Open your backpack');
menu('PROFILE',async()=>{
 const p=await character();
 show('PROFILE',[
  'NAME · '+(p.name||'ADVENTURER'),
  'FORM · '+(p.form||'ghost').toUpperCase(),
  'RECORD · '+(p.slot||1),
  'GUILD · None',
  'Reputation, titles and biographies can be extended as world systems mature.'
 ]);
},'Character profile');
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!card.hidden){card.hidden=true;e.stopPropagation();}
});
})();
