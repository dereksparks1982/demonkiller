/* Demon Killer temple paper doll and backpack. Independent of movement. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
// Temple windows are declared in the HTML so shortcuts work on initial load.
const paper=$('templePaper'),bag=$('templeBag');
let layer=30,latest='';
function toggle(win){win.hidden=!win.hidden;if(!win.hidden){win.style.zIndex=String(++layer);update();}}
$('templePaperButton').addEventListener('click',()=>toggle(paper));
$('templeBagButton').addEventListener('click',()=>toggle(bag));
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
async function update(){
 if(paper.hidden&&bag.hidden)return;
 const rec=localRecord();
 let player=rec.scene?.player||{},name=rec.name||'ADVENTURER',inventory={};
 const server=window.DemonKillerServer;
 if(server&&new URLSearchParams(location.search).has('dkSlot')){
  try{const c=await server.getCharacter(Number(new URLSearchParams(location.search).get('dkSlot')));player=c;name=c.name||name;inventory=c.inventory||{};}catch(_){}
 }
 if(!rec.scene){const label=$('lifeState')?.textContent||'';if(label.includes('GHOST'))player={...player,form:'ghost'};}
 $('templeCharacterName').textContent=name;
 $('templeCharacterForm').textContent=(player.form||'ghost').toUpperCase();
 const c=$('templePortrait').getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,128,160);
 const pic=player.form==='living'?human:ghost;
 if(pic.complete&&pic.naturalWidth)c.drawImage(pic,16,10,96,128);
 $('templeCharacterStats').textContent='FORM: '+(player.form||'ghost').toUpperCase();
 $('templeGold').textContent=(player.gold??0)+' GOLD';
 const snapshot=JSON.stringify(inventory);
 if(snapshot!==latest){latest=snapshot;const items=$('templeItems');items.replaceChildren();
  const entries=Object.entries(inventory).filter(([,n])=>n>0);
  if(!entries.length)items.textContent='Backpack is empty.';
  for(const [label,num] of entries){const item=document.createElement('span');item.textContent=label+' ×'+num;items.append(item);}
 }
}
setInterval(()=>{if(!paper.hidden||!bag.hidden)update();},1500);
})();