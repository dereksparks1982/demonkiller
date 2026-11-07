/* Demon Killer temple paper doll and backpack. Independent of movement. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
// Temple windows are declared in the HTML so shortcuts work on initial load.
const paper=$('templePaper'),bag=$('templeBag');

$('templeDeleteSave').addEventListener('click',async()=>{
 const server=window.DemonKillerServer;
 const live=!!server&&new URLSearchParams(location.search).has('dkSlot');
 const record=localRecord();
 let name=record.name||'this character';
 try{
  if(live){const c=await server.getCharacter(Number(new URLSearchParams(location.search).get('dkSlot')));name=c.name;}
 }catch(error){$('status').textContent='Cannot load character to delete: '+error.message;return;}
 if(!window.confirm('Permanently delete '+name+' and all their belongings? The world remains. This cannot be undone.'))return;
 const button=$('templeDeleteSave');button.disabled=true;
 try{
  if(live)await server.deleteCharacter(1,name);
  for(const key of ['dkSoftworks.demonkiller.characters.v1','dkSoftworks.demonkiller.activeCharacter.v1','dkSoftworks.demonkiller.outdoors.preview.v1','dkSoftworks.demonkiller.testCenter.v1','dkSoftworks.demonkiller.architectLocalBackup.v1'])
   localStorage.removeItem(key);
  location.replace('./index.html');
 }catch(error){$('status').textContent='Delete failed: '+error.message;button.disabled=false;}
});

let layer=30,latest='';
function toggle(win){win.hidden=!win.hidden;if(!win.hidden){win.style.zIndex=String(++layer);update();}}
// P and I are keyboard-only controls while playing.
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>{$(button.dataset.close).hidden=true;});
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.altKey||e.metaKey||e.repeat)return;
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)return;
 const key=e.key.toLowerCase();
 if(key==='p'||key==='i'){e.preventDefault();toggle(key==='p'?paper:bag);}
 if(key==='escape'){if(!bag.hidden)bag.hidden=true;else if(!paper.hidden)paper.hidden=true;}
});
for(const win of [paper,bag]){
 const bar=win.querySelector('.dk-uo-head');
 bar.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button'))return;
  const rect=win.getBoundingClientRect(),dx=e.clientX-rect.left,dy=e.clientY-rect.top;
  win.style.left=rect.left+'px';win.style.top=rect.top+'px';win.style.right='auto';bar.setPointerCapture(e.pointerId);
  const move=event=>{win.style.left=Math.max(0,Math.min(innerWidth-rect.width,event.clientX-dx))+'px';win.style.top=Math.max(0,Math.min(innerHeight-45,event.clientY-dy))+'px';};
  const stop=()=>{bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',stop);bar.removeEventListener('pointercancel',stop);};
  bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',stop,{once:true});bar.addEventListener('pointercancel',stop,{once:true});
 });
}
const human=new Image(),ghost=new Image();human.src='./assets/art/characters/human/human_south.png';ghost.src='./assets/art/characters/ghost/ghost_south.png';
human.onload=update;ghost.onload=update;
function localRecord(){
 try{
  const slots=JSON.parse(localStorage.getItem('dkSoftworks.demonkiller.characters.v1')||'null')?.slots;
  const id=Number(localStorage.getItem('dkSoftworks.demonkiller.activeCharacter.v1')||1);
  return slots?.[id-1]||{};
 }catch(_){return {};}
}
let currentInventory=null,rendering=false,transacting=false;
const connected=()=>Boolean(window.DemonKillerServer&&new URLSearchParams(location.search).has('dkSlot'));
function showHint(text){const hint=$('templeItemHint');if(hint)hint.textContent=text;}
function onDropOver(e){if(Array.from(e.dataTransfer.types||[]).includes('text/plain'))e.preventDefault();}
async function perform(action,fields){
 if(!connected()){showHint('Physical inventory requires the local DK Server.');return;}
 if(transacting)return;
 transacting=true;
 try{
  const result=await window.DemonKillerServer.gameAction(action,fields);
  showHint(result.event?.text||'Equipment updated.');
  await update(true);
 }catch(error){showHint(error.message);}
 finally{transacting=false;}
}
function use(serial,e){
 const item=currentInventory?.backpack.find(o=>o.serial===serial);
 if(!item)return;
 if(e.shiftKey){
  if(item.amount<=1){showHint('The stack cannot be split.');return;}
  return perform('split_stack',{serial,quantity:Math.floor(item.amount/2)});
 }
 return perform('use_item',{serial});
}
// The existing paper-doll frames are not buttons on the play screen.
for(const span of document.querySelectorAll('.dk-uo-slots span')){
 const slot=span.textContent.trim().toLowerCase();span.dataset.slot=slot;
 if(!['hand','light'].includes(slot))continue;
 span.addEventListener('dblclick',()=>{
  const item=currentInventory?.equipment?.[slot];
  if(item)perform('unequip_item',{serial:item.serial});
 });
 span.addEventListener('dragstart',e=>{
  const item=currentInventory?.equipment?.[slot];
  if(!item){e.preventDefault();return;}
  e.dataTransfer.setData('text/plain',item.serial);
 });
 span.addEventListener('dragover',onDropOver);
 span.addEventListener('drop',e=>{
  const serial=e.dataTransfer.getData('text/plain');
  const item=currentInventory?.backpack.find(i=>i.serial===serial);
  if(!item)return;e.preventDefault();
  if((slot==='hand'&&item.type==='tools')||(slot==='light'&&item.type==='torches'))
   perform('equip_item',{serial});
  else showHint('This item does not fit that equipment slot.');
 });
}
$('templeItems').addEventListener('dragover',onDropOver);
$('templeItems').addEventListener('drop',e=>{
 const serial=e.dataTransfer.getData('text/plain');
 const worn=Object.values(currentInventory?.equipment||{}).find(i=>i?.serial===serial);
 if(!worn)return;e.preventDefault();
 perform('unequip_item',{serial});
});
async function update(force=false){
 if((paper.hidden&&bag.hidden)||rendering)return;
 rendering=true;
 try{
  const rec=localRecord(),server=window.DemonKillerServer;
  let player=rec.scene?.player||{},name=rec.name||'ADVENTURER';
  if(connected()){
   try{
    const [character,items]=await Promise.all([
     server.getCharacter(Number(new URLSearchParams(location.search).get('dkSlot'))),
     server.inventory()
    ]);
    player=character;name=character.name||name;currentInventory=items;
   }catch(error){currentInventory=null;showHint('Server inventory unavailable: '+error.message);}
  }else currentInventory=null;
  if(!rec.scene){
   const label=$('lifeState')?.textContent||'';
   if(label.includes('GHOST'))player={...player,form:'ghost'};
  }
  $('templeCharacterName').textContent=name;
  $('templeCharacterForm').textContent=(player.form||'ghost').toUpperCase();
  const g=$('templePortrait').getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,128,160);
  const portrait=player.form==='living'?human:ghost;
  if(portrait.complete&&portrait.naturalWidth)g.drawImage(portrait,16,10,96,128);
  const survival=player.crafting||{};
  $('templeCharacterStats').textContent='FORM: '+(player.form||'ghost').toUpperCase()+
   (Number.isInteger(survival.health)?' · HEALTH '+survival.health+' · HUNGER '+survival.hunger:'');
  $('templeGold').textContent=(currentInventory?.gold??player.gold??0)+' GOLD';
  for(const slot of document.querySelectorAll('.dk-uo-slots span')){
   const record=currentInventory?.equipment?.[slot.dataset.slot];
   slot.textContent=slot.dataset.slot.toUpperCase()+(record?' · '+record.type.toUpperCase():'');
   slot.classList.toggle('dk-uo-equipped',Boolean(record));
   slot.draggable=Boolean(record);
   slot.title=record?'Double-click to unequip or drag to backpack':'';
  }
  const items=$('templeItems');
  const entries=currentInventory?.backpack||[];
  const signature=JSON.stringify([entries,currentInventory?.equipment,player.form]);
  if(force||latest!==signature){
   latest=signature;items.replaceChildren();
   if(!entries.length)items.textContent=connected()?'Backpack is empty.':'Inventory requires DK Server.';
   for(const entry of entries){
    const cell=document.createElement('button');cell.type='button';
    cell.className='dk-uo-item';cell.draggable=true;
    cell.textContent=entry.type.toUpperCase()+' ×'+entry.amount;
    cell.title='Double-click to use, Shift-double-click to split, drag to equip or combine.';
    cell.addEventListener('dblclick',event=>use(entry.serial,event));
    cell.addEventListener('dragstart',event=>event.dataTransfer.setData('text/plain',entry.serial));
    cell.addEventListener('dragover',onDropOver);
    cell.addEventListener('drop',event=>{
     event.preventDefault();
     const source=event.dataTransfer.getData('text/plain');
     if(source&&source!==entry.serial)
      perform('combine_stacks',{source_serial:source,target_serial:entry.serial});
    });
    items.append(cell);
   }
  }
 }finally{rendering=false;}
}
setInterval(()=>{if(!paper.hidden||!bag.hidden)update();},1800);
})();