/* Demon Killer M60 | UO-classic keyboard and War/Peace adapter.
 * Keyboard UI is presentation only. Stance is persisted by server character action.
 * No extra always-visible gameplay buttons; the small WAR/PEACE text is a status.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DKUOControls=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const MAP=Object.freeze({
 Tab:'war', 'Alt+C':'war',
 'Alt+P':'paper','Alt+I':'pack','Alt+D':'pack','Alt+K':'skills',
 'Alt+J':'journal','Alt+R':'radar','Alt+S':'status',
 'Alt+B':'spells','Alt+O':'options','Alt+X':'quit',
 'Alt+Enter':'fullscreen','?':'help',
 'L':'attackLast', 'T':'targetNearest'
});
function command(e){
 if(!e||e.ctrlKey||e.metaKey||e.isComposing)return null;
 const key=e.key?.length===1?e.key.toUpperCase():e.key;
 if(e.altKey)return MAP['Alt+'+key]||null;
 if(e.shiftKey&&key!=='?')return null;
 if(key==='Tab')return MAP.Tab;
 if(key==='?'||key==='L'||key==='T')return MAP[key];
 return null;
}
function mount({scope,getPlayer,getArea,locked=()=>false,editing=()=>false,
 toggleWar,notify=()=>{},attackLast=()=>{},targetNearest=()=>{},
 musicChanged=()=>{}}){
 if(!['temple','outdoor'].includes(scope)||typeof getPlayer!=='function'||
  typeof toggleWar!=='function')throw Error('Invalid UO controls context');
 const doc=document;
 let pending=false,lastTarget=null,current=null,history=[],mutator=null,largeRadar=false;
 const create=(tag,cls)=>{const e=doc.createElement(tag);if(cls)e.className=cls;return e;};
 const badge=create('span','dk-war-badge');
 badge.id='dkWarIndicator';badge.setAttribute('aria-live','polite');
 const anchor=scope==='outdoor'?doc.querySelector('.world-title'):doc.getElementById('lifeState')?.parentElement;
 anchor?.append(badge);
 function sync(){
  const p=getPlayer();
  const war=p?.war_mode===true;
  badge.textContent=war?'⚔ WAR MODE':'☮ PEACE';
  badge.classList.toggle('active',war);
  badge.title='TAB or ALT+C toggles War/Peace mode';
  return war;
 }
 sync();
 const panel=create('section','dk-shortcut-window');
 panel.id='dkUoShortcuts';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');
 panel.innerHTML='<header class="dk-shortcut-title"><strong id="dkShortcutTitle">GAME</strong><button type="button" id="dkShortcutClose" aria-label="Close window">×</button></header><div id="dkShortcutBody" class="dk-shortcut-body"></div>';
 doc.body.append(panel);
 const title=panel.querySelector('#dkShortcutTitle'),body=panel.querySelector('#dkShortcutBody');
 panel.querySelector('#dkShortcutClose').addEventListener('click',()=>{panel.hidden=true;});
 function text(tag,content,parent=body){
  const el=create(tag);el.textContent=content;parent.append(el);return el;
 }
 function log(s){
  if(!s)return;
  const value=String(s).trim().slice(0,240);
  if(!value||history.at(-1)?.text===value)return;
  history.push({text:value,stamp:new Date().toLocaleTimeString()});
  if(history.length>100)history.shift();
 }
 const journal=doc.getElementById(scope==='temple'?'status':'hudJournal');
 if(journal){
  log(journal.textContent);
  if(typeof MutationObserver==='function'){
   mutator=new MutationObserver(()=>log(journal.textContent));
   mutator.observe(journal,{subtree:true,characterData:true,childList:true});
  }
 }
 function show(kind){
  current=kind;panel.hidden=false;title.textContent={
   journal:'JOURNAL',skills:'SKILLS',radar:'RADAR MAP',
   spells:'SPELLBOOK',status:'CHARACTER STATUS',
   options:'OPTIONS',help:'CONTROLS'}[kind]||kind.toUpperCase();
  body.replaceChildren();
  const p=getPlayer()||{};
  if(kind==='journal'){
   const entries=history.length?history:[{stamp:'',text:'No journal entries yet.'}];
   for(const entry of entries)text('p',(entry.stamp?entry.stamp+' · ':'')+entry.text);
   body.scrollTop=body.scrollHeight;
  }else if(kind==='skills'){
   const skills=Object.entries(p.skillbook?.skills||p.skills||{});
   if(!skills.length)text('p','Your learned skills will be shown here.');
   for(const [name,record] of skills.sort((a,b)=>a[0].localeCompare(b[0]))){
    const value=typeof record==='number'?record:record?.value;
    text('p',name.replaceAll('_',' ')+' · '+
     (Number.isFinite(value)?(value/10).toFixed(1):'not trained'));
   }
  }else if(kind==='status'){
   const crafting=p.crafting||{};
   const values=[
    ['NAME',p.name||'Adventurer'],['FORM',p.form||'unknown'],
    ['STANCE',p.war_mode?'WAR':'PEACE'],['REGION',p.area_id||'Temple'],
    ['POSITION',(p.x??'?')+', '+(p.y??'?')],
    ['HEALTH',crafting.health??p.health??'?'],
    ['ENERGY',crafting.energy??p.energy??'?'],
    ['MANA',p.magic?.mana??'?'],['HUNGER',crafting.hunger??'?']
   ];
   for(const [k,v] of values)text('p',k+' · '+v);
  }else if(kind==='spells'){
   const magic=p.magic||{},learned=magic.known||magic.spells||[];
   text('p','Spellbook · '+(Array.isArray(learned)?(learned.join(', ')||'No spells recorded'):Object.keys(learned).join(', ')));
   text('p','Mana: '+(magic.mana??'?')+' · Choose spells from your paper doll when supported.');
  }else if(kind==='radar'){
   const area=getArea?.();
   if(!area||!area.width||!area.height){text('p','Map data unavailable.');return;}
   const cv=create('canvas');cv.width=largeRadar?384:224;cv.height=largeRadar?384:224;
   cv.className='dk-radar';body.append(cv);
   const ctx=cv.getContext('2d');if(!ctx)return;
   ctx.fillStyle='#152016';ctx.fillRect(0,0,cv.width,cv.height);
   const scaleX=cv.width/area.width,scaleY=cv.height/area.height;
   const walls=area.walls||[];
   for(let y=0;y<area.height;y++)for(let x=0;x<area.width;x++){
    const idx=y*area.width+x;
    const surface=area.floor?.[idx];
    ctx.fillStyle=walls[idx]?'#74727d':
     surface==='path'||surface==='stone'?'#766759':
     surface==='water'?'#2f5a76':'#33523c';
    ctx.fillRect(x*scaleX,y*scaleY,Math.ceil(scaleX),Math.ceil(scaleY));
   }
   ctx.fillStyle=p.war_mode?'#ff554c':'#ffe098';
   ctx.fillRect((p.x||0)*scaleX-2,(p.y||0)*scaleY-2,Math.max(4,scaleX),Math.max(4,scaleY));
   text('small','ALT+R again changes radar size. Marker shows your position.');
  }else if(kind==='options'){
   const prefsKey='dkSoftworks.demonkiller.menuPrefs.v1';
   let prefs={};try{prefs=JSON.parse(localStorage.getItem(prefsKey)||'{}')||{};}catch(_){}
   const label=create('label');const box=create('input');
   box.type='checkbox';box.checked=prefs.musicEnabled!==false;
   label.append(box,doc.createTextNode(' Enable music'));body.append(label);
   const volumeLabel=create('label');volumeLabel.className='dk-volume-label';
   volumeLabel.textContent='MUSIC VOLUME';const slider=create('input');slider.type='range';
   slider.min='0';slider.max='200';slider.step='5';
   slider.value=String(Number.isFinite(prefs.volumePercent)?prefs.volumePercent:200);
   volumeLabel.append(slider);body.append(volumeLabel);
   const save=()=>{
    try{const old=JSON.parse(localStorage.getItem(prefsKey)||'{}')||{};
     old.musicEnabled=box.checked;old.volumePercent=Number(slider.value);
     localStorage.setItem(prefsKey,JSON.stringify(old));
    }catch(_){}
    musicChanged(box.checked,Number(slider.value));
   };
   box.addEventListener('change',save);slider.addEventListener('input',save);
   text('p','Options are saved across the title screen and outdoor regions.');
  }else if(kind==='help'){
   for(const s of [
    'TAB / ALT+C · toggle WAR / PEACE',
    'Hold RIGHT MOUSE · move · farther = run',
    'LEFT CLICK · inspect · DOUBLE LEFT · use / attack in WAR',
    'WASD / ARROWS · cardinal movement',
    'P / ALT+P · paper doll · I / ALT+I · backpack',
    'ALT+K · skills · ALT+S · status · ALT+B · spellbook',
    'ALT+J · journal · ALT+R · radar map · ALT+O · options',
    'L · attack last selected target · T · select nearest enemy',
    'C · cult dossier · F8 · DK Architect',
    'ALT+X · return to title · ALT+ENTER · fullscreen',
    'ESC · close window · ? · this reference'
   ])text('p',s);
  }
 }
 function toggleWindow(kind){
  if(current===kind&&!panel.hidden){if(kind==='radar'){
    largeRadar=!largeRadar;show(kind);
   }else panel.hidden=true;
  }else{if(kind==='radar')largeRadar=false;show(kind);}
 }
 function toggleExisting(kind){
  const node=doc.getElementById(kind==='paper'?(scope==='temple'?'templePaper':'paperDoll'):
   (scope==='temple'?'templeBag':'backpack'));
  if(!node)return;
  node.hidden=!node.hidden;
  if(!node.hidden)node.style.zIndex='95';
 }
 async function changeWar(){
  if(pending||locked()||editing())return false;
  pending=true;
  try{
   const updated=await toggleWar();
   if(typeof updated==='boolean'&&getPlayer())getPlayer().war_mode=updated;
   sync();notify(getPlayer()?.war_mode?'War Mode engaged. Double-click a monster to attack.':
    'Peace Mode restored. Double-click to use objects.');
   return true;
  }catch(error){notify('War Mode unavailable: '+error.message);return false;}
  finally{pending=false;}
 }
 function onKey(e){
  if(e.repeat||e.target?.isContentEditable||
   ['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
  if(e.key==='Escape'&&!panel.hidden){
   e.preventDefault();e.stopImmediatePropagation();panel.hidden=true;return;
  }
  const cmd=command(e);
  if(!cmd||editing()||locked())return;
  if(cmd==='attackLast'||cmd==='targetNearest'){
   if(!getPlayer()?.war_mode)return;
  }
  e.preventDefault();e.stopImmediatePropagation();
  if(cmd==='war'){void changeWar();return;}
  if(cmd==='quit'){
   if(window.confirm('Return to the Demon Killer main menu?'))window.location.href='./index.html';
   return;
  }
  if(cmd==='fullscreen'){
   try{if(doc.fullscreenElement)void doc.exitFullscreen?.();
    else void doc.documentElement.requestFullscreen?.();}catch(_){}
   return;
  }
  if(cmd==='paper'||cmd==='pack'){toggleExisting(cmd);return;}
  if(cmd==='attackLast'){attackLast(lastTarget);return;}
  if(cmd==='targetNearest'){targetNearest();return;}
  toggleWindow(cmd);
 }
 doc.addEventListener('keydown',onKey,true);
 return Object.freeze({sync,isWar:()=>getPlayer()?.war_mode===true,
  rememberTarget:id=>{if(typeof id==='string'&&id.length<81)lastTarget=id;},
  selected:()=>lastTarget,
  show,close:()=>{panel.hidden=true;},
  destroy:()=>{doc.removeEventListener('keydown',onKey,true);mutator?.disconnect();badge.remove();panel.remove();}
 });
}
return Object.freeze({MAP,command,mount});
});