/* Demon Killer classic interface. UO-style windows, no server controls shown. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const doll=$('paperDoll'),bag=$('backpack');
if(!doll||!bag)return;
const icons={herbs:'❧',wood:'▰',ore:'◆',bread:'◒',tools:'⚒',produce:'♣',
 meals:'◉',torches:'♜',rations:'▣',bandages:'✚',gold:'●'};
let lastInventory='',lastFigure='',lastJournal='';
let remote=null,remoteBusy=false,actionBusy=false;
async function refreshServerBag(){
 const server=window.DemonKillerServer;
 if(!state().serverConnected||!server||remoteBusy)return;
 remoteBusy=true;
 try{remote=await server.inventory();refresh(true);}catch(_){remote=null;}
 finally{remoteBusy=false;}
}
async function itemAction(action,fields){
 const server=window.DemonKillerServer;
 if(!state().serverConnected||!server||actionBusy)return;
 actionBusy=true;
 try{
  const result=await server.gameAction(action,fields);
  $('bagHelp').textContent=result.event?.text||'Item updated.';
  remote=await server.inventory();
  window.dispatchEvent(new Event('dk-inventory-updated'));
  refresh(true);
 }catch(error){$('bagHelp').textContent=error.message;}
 finally{actionBusy=false;}
}

const pref='dkSoftworks.demonkiller.uoWindows.v1';
$('deleteInGameSave').addEventListener('click',async()=>{
 const current=state(),server=window.DemonKillerServer;
 const name=current.player?.name||
  (()=>{try{return JSON.parse(localStorage.getItem('dkSoftworks.demonkiller.characters.v1')||'null')?.slots?.[0]?.name;}catch(_){return null;}})()||'this character';
 if(!window.confirm('Permanently delete '+name+' and all their belongings? The world remains. This cannot be undone.'))return;
 const button=$('deleteInGameSave');button.disabled=true;
 try{
  if(current.serverConnected){
   if(!server||!current.player?.name)throw Error('Character record is not ready');
   await server.deleteCharacter(1,current.player.name);
  }
  for(const key of ['dkSoftworks.demonkiller.characters.v1','dkSoftworks.demonkiller.activeCharacter.v1','dkSoftworks.demonkiller.outdoors.preview.v1','dkSoftworks.demonkiller.testCenter.v1','dkSoftworks.demonkiller.architectLocalBackup.v1'])localStorage.removeItem(key);
  window.location.replace('./index.html');
 }catch(error){$('hudJournal').textContent='Delete failed: '+error.message;button.disabled=false;}
});

function state(){return window.DKOutdoorState?.()||{};}
let topLayer=30;
// Window open/close controls are initialized inline in outdoor.html, independent of this script.
// Drag only a window's header. Never intercept the game canvas's RMB movement.
for(const win of [doll,bag]){
 const bar=win.querySelector('.uo-window-head');
 bar.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button'))return;
  const r=win.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;
  win.style.left=r.left+'px';win.style.top=r.top+'px';win.style.right='auto';
  win.style.zIndex=String(++topLayer);bar.setPointerCapture(e.pointerId);
  function move(ev){
   win.style.left=Math.max(0,Math.min(innerWidth-r.width,ev.clientX-dx))+'px';
   win.style.top=Math.max(0,Math.min(innerHeight-45,ev.clientY-dy))+'px';
  }
  function stop(){bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',stop);bar.removeEventListener('pointercancel',stop);
   try{localStorage.setItem(pref,JSON.stringify(Object.fromEntries([doll,bag].map(w=>[w.id,{left:w.style.left,top:w.style.top}]))));}catch(_){}
  }
  bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',stop,{once:true});bar.addEventListener('pointercancel',stop,{once:true});
 });
}
try{
 const saved=JSON.parse(localStorage.getItem(pref)||'{}');
 for(const win of [doll,bag]){
  const w=saved[win.id];if(!w)continue;
  const x=parseFloat(w.left),y=parseFloat(w.top);
  if(Number.isFinite(x)&&Number.isFinite(y)){win.style.left=Math.max(0,Math.min(innerWidth-80,x))+'px';win.style.top=Math.max(0,Math.min(innerHeight-45,y))+'px';win.style.right='auto';}
 }
}catch(_){}
const portrait=new Image();portrait.onload=()=>drawFigure();
portrait.src='./assets/art/characters/human/human_south.png';
const ghostPortrait=new Image();ghostPortrait.onload=()=>drawFigure();
ghostPortrait.src='./assets/art/characters/ghost/ghost_south.png';
function drawFigure(){
 const ctx=$('paperFigure').getContext('2d');if(!ctx)return;
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,128,192);
 const p=state().player||{},ghost=p.form==='ghost',im=ghost?ghostPortrait:portrait;
 if(im.complete&&im.naturalWidth){ctx.drawImage(im,16,27,96,128);}
 else{ctx.fillStyle=ghost?'#afbddf':'#a78d83';ctx.fillRect(53,30,22,32);ctx.fillRect(45,64,38,61);ctx.fillRect(47,125,13,40);ctx.fillRect(68,125,13,40);}
}
const symbols=Object.freeze(icons);
function itemUse(name,serial,split=false){
 if(!state().serverConnected){$('bagHelp').textContent='The online preview has no server inventory actions.';return;}
 if(!serial){$('bagHelp').textContent='Waiting for the server item identity.';return;}
 if(split){
  const item=remote?.backpack.find(i=>i.serial===serial);
  if(!item||item.amount<2){$('bagHelp').textContent='This stack cannot be split.';return;}
  return itemAction('split_stack',{serial,quantity:Math.floor(item.amount/2)});
 }
 return itemAction('use_item',{serial});
}

function refresh(force=false){
 const s=state(),p=s.player||{},inventory=p.inventory||{};
 const pack=remote&&s.serverConnected?remote.backpack.map(i=>[i.type,i.amount,i.serial]):
  Object.entries(inventory).filter(([,n])=>Number(n)>0).sort(([a],[b])=>a.localeCompare(b)).map(([type,amount])=>[type,amount,null]);
 const snap=JSON.stringify([pack,remote?.gold??p.gold,p.bank_gold,s.serverConnected]);
 if(force||snap!==lastInventory){
  lastInventory=snap;$('bagGold').textContent=String(remote?.gold??p.gold??0);$('bagCapacity').textContent=pack.reduce((n,i)=>n+Number(i[1]),0)+' / 200';
  const box=$('bagItems');box.replaceChildren();
  for(const [name,num,serial] of pack){
   const b=document.createElement('button');b.type='button';b.className='bag-item';
   b.title=name+' × '+num+(serial?' · Double-click to use, Shift-double-click to split. Drag onto matching stack to combine.':'');
   b.setAttribute('aria-label',name+', '+num);
   const symbol=document.createElement('span');symbol.className='bag-symbol';symbol.textContent=symbols[name]||'▤';
   const label=document.createElement('span');label.textContent=name;
   const count=document.createElement('span');count.className='bag-count';count.textContent='×'+num;
   b.append(symbol,label,count);b.addEventListener('dblclick',e=>itemUse(name,serial,e.shiftKey));
   if(serial){
    b.draggable=true;b.dataset.serial=serial;b.dataset.type=name;
    b.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',serial));
    b.addEventListener('dragover',e=>{if(Array.from(e.dataTransfer.types||[]).includes('text/plain'))e.preventDefault();});
    b.addEventListener('drop',e=>{
     e.preventDefault();const from=e.dataTransfer.getData('text/plain');
     if(from&&from!==serial&&remote?.backpack.some(item=>item.serial===from)){
      e.stopPropagation();
      itemAction('combine_stacks',{source_serial:from,target_serial:serial});
     }
    });
   }
   box.append(b);
  }
  if(!pack.length){const empty=document.createElement('p');empty.textContent=s.serverConnected?'Your backpack is empty.':'Inventory available when DK Server is connected.';empty.style.gridColumn='1 / -1';box.append(empty);}
 }
 const equipped=p.crafting||{},other=JSON.stringify([p.name,p.form,p.crafting,p.skills,remote?.equipment]);
 if(force||other!==lastFigure){
  lastFigure=other;drawFigure();$('paperName').textContent=p.name||'ADVENTURER';
  $('paperForm').textContent=(p.form||'living').toUpperCase();
  document.querySelectorAll('.equip-slot').forEach(node=>{
   const k=node.dataset.equip,gear=remote?.equipment?.[k]||null;
   const value=gear?.type||equipped[k]||null;
   node.textContent=value?k.toUpperCase()+': '+value:k.toUpperCase();
   node.classList.toggle('filled',Boolean(value));
   node.dataset.serial=gear?.serial||'';
   node.draggable=Boolean(gear?.serial&&s.serverConnected);
   node.title=gear?.serial?'Double-click to remove. Drag onto backpack to unequip.':'';
  });
  $('paperStats').textContent='HEALTH '+(equipped.health??'—')+'  HUNGER '+(equipped.hunger??'—')+'  ENERGY '+(equipped.energy??'—');
 }
 const journal=$('message')?.textContent||'';
 if(journal&&journal!==lastJournal){lastJournal=journal;$('hudJournal').textContent=journal;}
}
for(const slot of document.querySelectorAll('.equip-slot')){
 slot.addEventListener('dragover',e=>{if(Array.from(e.dataTransfer.types||[]).includes('text/plain'))e.preventDefault();});
 slot.addEventListener('drop',e=>{
  e.preventDefault();const serial=e.dataTransfer.getData('text/plain');
  const item=remote?.backpack.find(i=>i.serial===serial);
  if(!item)return;
  if((slot.dataset.equip==='hand'&&item.type==='tools')||
     (slot.dataset.equip==='light'&&item.type==='torches'))itemAction('equip_item',{serial});
  else $('bagHelp').textContent='That item cannot be equipped in this slot.';
 });
}
// Equipment has an immutable identity: unequip that actual item, not
// whichever item type happens to be first in the backpack.
for(const slot of document.querySelectorAll('.equip-slot')){
 slot.addEventListener('dblclick',()=>{if(slot.dataset.serial)itemAction('unequip_item',{serial:slot.dataset.serial});});
 slot.addEventListener('dragstart',event=>{
  if(!slot.dataset.serial){event.preventDefault();return;}
  event.dataTransfer.setData('text/plain',slot.dataset.serial);
 });
}
const bagCanvas=$('bagItems');
bagCanvas.addEventListener('dragover',event=>{
 if(Array.from(event.dataTransfer.types||[]).includes('text/plain'))event.preventDefault();
});
bagCanvas.addEventListener('drop',event=>{
 const serial=event.dataTransfer.getData('text/plain');
 const equipped=Object.values(remote?.equipment||{}).some(item=>item?.serial===serial);
 if(!equipped)return;
 event.preventDefault();
 itemAction('unequip_item',{serial});
});
const gameCanvas=$('world');
gameCanvas?.addEventListener('dragover',event=>{
 if(Array.from(event.dataTransfer.types||[]).includes('text/plain'))event.preventDefault();
});
gameCanvas?.addEventListener('drop',event=>{
 const serial=event.dataTransfer.getData('text/plain');
 if(!remote?.backpack.some(item=>item.serial===serial))return;
 event.preventDefault();
 itemAction('move_stack',{serial,destination:'ground'});
});
setInterval(refreshServerBag,3500);setInterval(refresh,850);
refreshServerBag();refresh(true);
})();