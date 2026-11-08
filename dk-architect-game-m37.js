/* M37: Architect is a visible mode in the outdoor game, not a page to hunt for. */
(()=>{
'use strict';
const button=document.getElementById('editMode');
const overlay=document.getElementById('dkOutdoorArchitect');
const frame=document.getElementById('dkOutdoorArchitectFrame');
if(!button||!overlay||!frame)return;
const closed=()=>overlay.hidden;
function isOpen(){return !overlay.hidden;}
function open(){
 if(isOpen())return;
 const game=new URLSearchParams(location.search);
 const area=window.DKOutdoorState?.()?.player?.area_id||
  'dk.courtyard.lilith.001';
 const p=new URLSearchParams({embedded:'1',area_id:area});
 if(game.has('dkSlot'))p.set('dkSlot',game.get('dkSlot'));
 frame.src='./dk-architect-outdoors-m36.html?'+p;
 overlay.hidden=false;document.body.classList.add('dk-outdoor-editing');
 button.setAttribute('aria-pressed','true');
 window.dispatchEvent(new Event('dk-architect-opened'));
 frame.focus();
}
function close(){
 if(!isOpen())return;
 overlay.hidden=true;document.body.classList.remove('dk-outdoor-editing');
 button.setAttribute('aria-pressed','false');
 frame.src='about:blank';
 window.dispatchEvent(new Event('dk-architect-resume'));
 document.getElementById('world')?.focus({preventScroll:true});
}
function toggle(){isOpen()?close():open();}
button.addEventListener('click',toggle);
document.getElementById('dkOutdoorArchitectClose')?.addEventListener('click',close);
document.addEventListener('keydown',e=>{
 if(e.key!=='F8'||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
 e.preventDefault();e.stopImmediatePropagation();toggle();
},true);
window.addEventListener('message',e=>{
 if(e.origin===location.origin&&e.data?.dkArchitect==='close')close();
});
window.DKOutdoorArchitect=Object.freeze({toggle,open,close,isOpen});
})();
