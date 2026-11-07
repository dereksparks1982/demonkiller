/* Demon Killer classic interface. UO-style windows, no server controls shown. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const doll=$('paperDoll'),bag=$('backpack');
if(!doll||!bag)return;
const icons={herbs:'❧',wood:'▰',ore:'◆',bread:'◒',tools:'⚒',produce:'♣',
 meals:'◉',torches:'♜',rations:'▣',bandages:'✚',gold:'●'};
let lastInventory='',lastFigure='',lastJournal='';
const pref='dkSoftworks.demonkiller.uoWindows.v1';
function state(){return window.DKOutdoorState?.()||{};}
function toggle(el){el.hidden=!el.hidden;if(!el.hidden){el.style.zIndex=String(++topLayer);el.querySelector('button')?.focus({preventScroll:true});}refresh(true);}
let topLayer=30;
$('openPaperDoll').addEventListener('click',()=>toggle(doll));
$('openBackpack').addEventListener('click',()=>toggle(bag));
document.querySelectorAll('[data-close-window]').forEach(b=>b.addEventListener('click',()=>{$(b.dataset.closeWindow).hidden=true;$('world')?.focus({preventScroll:true});}));
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.altKey||e.metaKey||e.repeat)return;
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)return;
 const k=e.key.toLowerCase();
 if(k==='p'||k==='i'){e.preventDefault();toggle(k==='p'?doll:bag);}
 if(k==='escape'){
  if(!bag.hidden)bag.hidden=true;
  else if(!doll.hidden)doll.hidden=true;
 }
});
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
function itemUse(name){
 const s=state();if(!s.serverConnected){$('bagHelp').textContent='This browser preview has no server inventory actions.';return;}
 const select=$('itemChoice');if(select&&[...select.options].some(x=>x.value===name))select.value=name;
 const byItem={tools:'equipTools',torches:'equipTorch',bread:'eatFood',rations:'eatFood',meals:'eatFood',produce:'eatFood'};
 const action=byItem[name];
 if(!action){$('bagHelp').textContent='Inspect '+name+'. No double-click use action is available yet.';return;}
 // Food is consumed through the existing server action handler.
 $(action)?.click();
}
function refresh(force=false){
 const s=state(),p=s.player||{},inventory=p.inventory||{};
 const pack=Object.entries(inventory).filter(([,n])=>Number(n)>0).sort(([a],[b])=>a.localeCompare(b));
 const snap=JSON.stringify([pack,p.gold,p.bank_gold,s.serverConnected]);
 if(force||snap!==lastInventory){
  lastInventory=snap;$('bagGold').textContent=String(p.gold??0);$('bagCapacity').textContent=pack.length+' TYPES';
  const box=$('bagItems');box.replaceChildren();
  for(const [name,num] of pack){
   const b=document.createElement('button');b.type='button';b.className='bag-item';
   b.title=name+' × '+num+' (double-click to use)';b.setAttribute('aria-label',name+', '+num);
   const symbol=document.createElement('span');symbol.className='bag-symbol';symbol.textContent=symbols[name]||'▤';
   const label=document.createElement('span');label.textContent=name;
   const count=document.createElement('span');count.className='bag-count';count.textContent='×'+num;
   b.append(symbol,label,count);b.addEventListener('dblclick',()=>itemUse(name));box.append(b);
  }
  if(!pack.length){const empty=document.createElement('p');empty.textContent=s.serverConnected?'Your backpack is empty.':'Inventory available when DK Server is connected.';empty.style.gridColumn='1 / -1';box.append(empty);}
 }
 const equipped=p.crafting||{},other=JSON.stringify([p.name,p.form,p.crafting,p.skills]);
 if(force||other!==lastFigure){
  lastFigure=other;drawFigure();$('paperName').textContent=p.name||'ADVENTURER';
  $('paperForm').textContent=(p.form||'living').toUpperCase();
  document.querySelectorAll('.equip-slot').forEach(node=>{
   const k=node.dataset.equip;const value=equipped[k]||null;
   node.textContent=value?k.toUpperCase()+': '+value:k.toUpperCase();
   node.classList.toggle('filled',Boolean(value));
  });
  $('paperStats').textContent='HEALTH '+(equipped.health??'—')+'  HUNGER '+(equipped.hunger??'—')+'  ENERGY '+(equipped.energy??'—');
 }
 const journal=$('message')?.textContent||'';
 if(journal&&journal!==lastJournal){lastJournal=journal;$('hudJournal').textContent=journal;}
}
setInterval(refresh,850);refresh(true);
})();