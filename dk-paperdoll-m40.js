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
// The entire authoritative UO-scale skillbook, grouped and scrollable,
// with physical skill use and per-skill up/down/locked training controls.
const FIELD_ACTIONS=new Set(['tracking','hiding','stealth','camping','anatomy','animal_lore','forensic_evaluation','meditation','spirit_speak']);
function feedback(text){entry(text);const node=document.createElement('p');node.className='dk-paper-feedback';node.textContent=text;content.prepend(node);}
function button(label,click,disabled=false){
 const b=document.createElement('button');b.type='button';b.className='dk-paper-action';
 b.textContent=label;b.disabled=disabled;b.addEventListener('click',click);return b;
}
async function showSkillbook(){
 const p=await character();
 let data={skills:p.skillbook?.skills||p.skills||{},groups:{}};
 if(connected()){
  try{data=await window.DemonKillerServer.skills();}
  catch(error){show('SKILLS',['Could not load skill records: '+error.message]);return;}
 }
 const entries=data.skills||{},groups=data.groups||{All:Object.keys(entries)};
 show('SKILLS · '+Object.keys(entries).length,
  ['TOTAL · '+(((data.total||0)/10).toFixed(1))+' / '+
   (((data.total_cap||7000)/10).toFixed(1))+' skill points',
   'UO-style skill locks control what can gain and what can decrease at the 700-point cap.']);
 for(const [heading,names]of Object.entries(groups)){
  const title=document.createElement('h3');title.className='dk-skill-heading';title.textContent=heading.toUpperCase();
  content.append(title);
  for(const skill of names){
   const detail=entries[skill];if(!detail)continue;
   const row=document.createElement('div');row.className='dk-skill-row';
   const value=typeof detail==='object'?detail.value:detail;
   const name=document.createElement('span');name.textContent=skill.replaceAll('_',' ').toUpperCase()+
    ' · '+((value||0)/10).toFixed(1);
   row.append(name);
   if(detail&&typeof detail==='object'){
    const directions=['up','locked','down'];
    const lock=button((detail.lock||'up').toUpperCase(),async()=>{
     try{
      const at=directions.indexOf(detail.lock||'up'),next=directions[(at+1)%3];
      await window.DemonKillerServer.gameAction('skill_lock',{skill,lock:next});
      await showSkillbook();feedback(skill+' training changed to '+next+'.');
     }catch(e){feedback(e.message);}
    },!connected());
    lock.title='Change the skill training lock: UP → LOCKED → DOWN';
    row.append(lock);
   }
   if(FIELD_ACTIONS.has(skill)){
    const use=button('USE',async()=>{
     try{
      const result=await window.DemonKillerServer.gameAction('use_skill',{skill});
      await showSkillbook();feedback(result.event?.text||'Used '+skill);
     }catch(e){feedback(e.message);}
    },!connected());
    use.title='Use '+skill+' against the current surrounding world';
    row.append(use);
   }
   content.append(row);
  }
 }
}
menu('SKILLS',showSkillbook,'Skill groups, training locks, and field skill actions');
async function showSpellbook(){
 if(!connected()){show('SPELLBOOK',['Spells require a connected DK Server. The GitHub Pages preview cannot simulate mana or magic.']);return;}
 try{
  const api=window.DemonKillerServer,book=await api.spells();
  show('SPELLBOOK',['MANA · '+book.mana+' / '+book.max_mana,
   'Cast magic at visible monsters along a north/south or east/west path. Reagents are consumed by the server.']);
  for(const [id,info]of Object.entries(book.spells||{})){
   const row=document.createElement('div');row.className='dk-skill-row';
   const title=document.createElement('span');
   title.textContent=info.name+' · '+info.mana+' mana · '+info.reagents.herbs+' herbs'+
    (info.learned?'':' · requires '+(info.min_magery/10).toFixed(1)+' Magery');
   const cast=button('CAST',async()=>{
    try{
     const p=await character(),args={spell:id};
     if(info.target==='monster'){
      const list=await api.creatures();
      const chosen=(list.creatures||[]).filter(m=>m.area_id===p.area_id&&
       (m.x===p.x||m.y===p.y)&&
       Math.abs(m.x-p.x)+Math.abs(m.y-p.y)<=info.range)
       .sort((a,b)=>(Math.abs(a.x-p.x)+Math.abs(a.y-p.y))-
        (Math.abs(b.x-p.x)+Math.abs(b.y-p.y)))[0];
      if(!chosen){feedback('No monster in cardinal spell range. Move into a straight line first.');return;}
      args.target_id=chosen.id;
     }
     const result=await api.gameAction('cast_spell',args);
     await showSpellbook();
     feedback((result.event?.text||'Spell cast.')+
      (result.event?.damage?' Damage '+result.event.damage:''));
    }catch(error){feedback(error.message);}
   },!info.learned||book.mana<info.mana);
   row.append(title,cast);content.append(row);
  }
 }catch(error){show('SPELLBOOK',['Could not load spells: '+error.message]);}
}
menu('SPELLBOOK',showSpellbook,'Server spells, mana, reagents and casting');
async function showCrafting(){
 if(!connected()){show('CRAFTING',['Physical crafting and the mill require a running DK Server. The GitHub Pages preview cannot manufacture or save items.']);return;}
 const api=window.DemonKillerServer;
 try{
  const [c,mill]=await Promise.all([character(),api.milling()]);
  show('CRAFTING & MILLING',[
   'STATION · '+mill.station_label,
   'OPERATED BY · '+(mill.operator||'vacant'),
   'SHOP STOCK · '+JSON.stringify(mill.stock||{}),
   'YOUR PACK · grain '+(c.inventory?.grain||0)+' · grist '+(c.inventory?.grist||0)+
   ' · flour '+(c.inventory?.flour||0),
   'First grind 2 grain into 1 grist with tools equipped. Then sack 1 grist into 1 flour. These take separate world-minute work actions.',
   'While the living baker is present, NPC milling uses real inventory and wages. The bakery bakes bread from stored flour.'
  ]);
  const tasks=[['GRIND GRAIN','mill_grind',null],['SACK FLOUR','mill_sack',null],
   ['MAKE TORCH','craft','torch'],['MAKE RATIONS','craft','rations'],
   ['MAKE BANDAGES','craft','bandages'],['SMITH TOOLS','craft','tools']];
  for(const [label,action,recipe]of tasks){
   const row=document.createElement('div');row.className='dk-skill-row';
   const text=document.createElement('span');text.textContent=label;
   const enabled=(action==='craft'||mill.near_station);
   const b=button('MAKE',async()=>{
    try{
     const r=await api.gameAction(action,recipe?{recipe}:{});
     await showCrafting();
     feedback(r.event?.text||'The work is complete.');
    }catch(error){feedback(error.message);}
   },!enabled);
   b.title=enabled?label:'Stand by the village bakery milling station first';
   row.append(text,b);content.append(row);
  }
 }catch(error){show('CRAFTING',['Production records unavailable: '+error.message]);}
}
menu('CRAFTING',showCrafting,'Real crafting recipes, grinding grain, sacking flour and NPC production');

async function showBusinesses(){
 if(!connected()){
  show('BUSINESS',['Ownership, stock, assistants and NPC purchases require a real DK Server. The static Pages preview is not an economy server.']);return;
 }
 try{
  const api=window.DemonKillerServer,[report,p,maintenance,trade]=await Promise.all([api.playerBusiness(),character(),api.maintenance(),api.npcCommerce()]);
  show('BUSINESS · OWNERSHIP',[
   'At a storefront you can purchase an existing business from its proprietor.',
   'When present, NPC shoppers wait for you to press SERVE CUSTOMER. If you leave, your assistant handles their purchases.',
   'The employee keeps the existing schedule and payroll. Store funds, merchandise and your personal gold remain separate.',
   'Gold · '+(p.gold||0)+' · Owned businesses · '+Object.keys(report.ownership||{}).length,
   'No new buildings are placed automatically. Architect controls the village layout.'
  ]);
  for(const b of report.businesses){
   const title=document.createElement('h3');title.className='dk-skill-heading';
   title.textContent=b.name.toUpperCase()+' · '+(b.owner?'OWNED':'AVAILABLE');
   content.append(title);
   const detail=document.createElement('p');
   detail.textContent='Price to acquire '+b.cost+' gold · Treasury '+b.coins+
    ' · Stock '+b.stock+' · On duty '+(b.on_duty||'nobody');
   content.append(detail);
   if(!b.owner){
    content.append(button('BUY EXISTING BUSINESS',async()=>{
     try{
      const r=await api.gameAction('buy_business',{business_id:b.id});
      await showBusinesses();feedback(r.event?.text||'Business acquired.');
     }catch(e){feedback(e.message);}
    },!b.near||p.gold<b.cost));
    continue;
   }
   const customers=(trade.waiting_customers||[]).filter(order=>order.business_id===b.id);
   for(const customer of customers){
    const order=document.createElement('div');order.className='dk-skill-row';
    const label=document.createElement('span');
    label.textContent=customer.npc_name+' wants to buy '+b.product+
     ' for '+customer.price+' gold · leaves at minute '+customer.expires_minute;
    const serve=button('SERVE CUSTOMER',async()=>{
     try{
      const result=await api.gameAction('serve_customer',
       {npc_id:customer.npc_id,business_id:b.id});
      await showBusinesses();feedback(result.event?.text||'Customer served.');
     }catch(error){feedback(error.message);}
    },!b.near||!customer.near_owner);
    order.append(label,serve);content.append(order);
   }
   const machine=(maintenance.shops||[]).find(m=>m.id===b.id);
   if(machine){
    const status=document.createElement('p');status.textContent=
     'MACHINERY · '+(machine.broken?'BROKEN':'WORKING')+
     ' · wear '+machine.wear+'/100 · repairs '+machine.repairs+
     (machine.pending?' · hired repair expected after world minute '+machine.pending.due:'');
    content.append(status);
    if(machine.broken){
     const repairButtons=document.createElement('div');repairButtons.className='dk-skill-row';
     for(const [label,action]of [['REPAIR (1 TOOL)','repair_workshop'],['HIRE REPAIRER (20G)','hire_repair']]){
      const control=button(label,async()=>{
       try{
        const result=await api.gameAction(action,{business_id:b.id});
        await showBusinesses();feedback(result.event?.text||'Repairs arranged.');
       }catch(error){feedback(error.message);}
      },!b.near||(action==='hire_repair'&&!!machine.pending));
      repairButtons.append(control);
     }
     content.append(repairButtons);
    }
   }
   if(['village_bakery','village_smithy','village_tavern'].includes(b.id))
    content.append(button('OPERATE WORKSHOP',async()=>{
     try{
      const r=await api.gameAction('run_workshop',{business_id:b.id});
      await showBusinesses();feedback(r.event?.text||'Manual production finished.');
     }catch(e){feedback(e.message);}
    },!b.near));
   const controls=document.createElement('div');controls.className='dk-skill-row';
   const operations=[
    ['ASSISTANT '+(b.assistant_enabled?'ON':'OFF'),'set_assistant',
     {enabled:!b.assistant_enabled}],
    ['PRODUCTION '+(b.production_enabled?'ON':'OFF'),'set_production',
     {enabled:!b.production_enabled}],
    ['PRICE '+b.price_mode.toUpperCase(),'set_business_price',
     {price_mode:b.price_mode==='standard'?'premium':b.price_mode==='premium'?'budget':'standard'}],
    ['INVEST 10 GOLD','invest_business',{amount:10}],
    ['DRAW 10 GOLD','draw_business',{amount:10}]
   ];
   for(const [label,action,data]of operations)
    controls.append(button(label,async()=>{
     try{
      const r=await api.gameAction(action,{business_id:b.id,...data});
      await showBusinesses();feedback(r.event?.text||'Business updated.');
     }catch(e){feedback(e.message);}
    },!b.near));
   content.append(controls);
   const items=new Set([b.product||'bread',...Object.keys(b.other_stock||{})]);
   items.add('grain');items.add('flour');items.add('produce');items.add('wood');items.add('ore');
   const stock=document.createElement('div');stock.className='dk-skill-row';
   const select=document.createElement('select');select.setAttribute('aria-label','Business item');
   for(const item of items){
    const opt=document.createElement('option');opt.value=item;opt.textContent=item;select.append(opt);
   }
   const quantity=document.createElement('input');quantity.type='number';quantity.min='1';
   quantity.max='20';quantity.value='1';quantity.style.width='43px';quantity.setAttribute('aria-label','Quantity');
   for(const [label,action]of [['STOCK','stock_business'],['TAKE','take_business_stock']])
    stock.append(button(label,async()=>{
     try{
      const r=await api.gameAction(action,{business_id:b.id,
       item_type:select.value,quantity:Number(quantity.value)});
      await showBusinesses();feedback(r.event?.text||'Physical stock moved.');
     }catch(e){feedback(e.message);}
    },!b.near));
   stock.prepend(select,quantity);content.append(stock);
  }
 }catch(error){show('BUSINESS',['Server management unavailable: '+error.message]);}
}
menu('BUSINESS',showBusinesses,'Own existing shops, operate the counter, manage assistants, stock, prices and gold');


async function showAnimals(){
 if(!connected()){show('ANIMALS',['Tamed animals require the persistent DK Server. No pet is simulated on static GitHub Pages.']);return;}
 try{
  const api=window.DemonKillerServer,p=await character();
  const [record,creatures]=await Promise.all([api.companions(),api.creatures()]);
  show('ANIMALS · COMPANIONS',[
   'Owned · '+record.pets.length+' / '+record.max_pets,
   'Weaken a wild wolf below half health. Stand beside it with produce in your pack and attempt to tame it.',
   'Tame attempts cost food and can fail. A real pet follows, protects, eats and can die.'
  ]);
  for(const wolf of creatures.creatures||[]){
   if(wolf.kind!=='wolf'||wolf.area_id!==p.area_id||
    Math.abs(wolf.x-p.x)+Math.abs(wolf.y-p.y)>1)continue;
   const row=document.createElement('div');row.className='dk-skill-row';
   const label=document.createElement('span');
   label.textContent='Wild Wolf · '+wolf.health+' / 24 health';
   const tame=button('TAME',async()=>{
    try{
     const response=await api.gameAction('tame_creature',{target_id:wolf.id});
     await showAnimals();feedback(response.event?.text||'Animal taming attempted.');
    }catch(error){feedback(error.message);}
   },wolf.health>12||!record.can_tame);
   row.append(label,tame);content.append(row);
  }
  for(const pet of record.pets){
   const label=document.createElement('p');label.textContent=
    pet.id+' · '+pet.health+' health · '+pet.mode+' · '+pet.loyalty+' loyalty';
   content.append(label);
   const row=document.createElement('div');row.className='dk-skill-row';
   const near=pet.area_id===p.area_id&&Math.abs(pet.x-p.x)+Math.abs(pet.y-p.y)<=2;
   for(const [label,action] of [['FEED','feed_pet'],['FOLLOW','pet_follow'],
      ['STAY','pet_stay'],['GUARD','pet_guard'],['RELEASE','release_pet']]){
    const b=button(label,async()=>{
     try{
      if(action==='release_pet'&&!window.confirm('Release your companion into the wild?'))return;
      const result=await api.gameAction(action,{pet_id:pet.id});
      await showAnimals();feedback(result.event?.text||'Companion updated.');
     }catch(error){feedback(error.message);}
    },!near);
    row.append(b);
   }
   content.append(row);
  }
 }catch(error){show('ANIMALS',['Companion records unavailable: '+error.message]);}
}
menu('ANIMALS',showAnimals,'UO-style taming, animal care, followers and pet commands');

async function showThievery(observation=null){
 if(!connected()){
  show('THIEVING',['Snooping and stealing require a real DK Server. The browser preview does not hold NPC inventories.']);
  return;
 }
 try{
  const api=window.DemonKillerServer,[p,world]=await Promise.all([character(),api.living()]);
  show('THIEVING · SNOOPING & STEALING',[
   'Stand within two tiles of an NPC to examine their personal backpack.',
   'Select a known item while adjacent to attempt a one-item pickpocket. Success depends on Stealing skill.',
   'Witnesses may report you to the village guard; a failed theft can alert the victim.',
   'Never steal from private player saves. All item transfers, law cases and penalties belong to DK Server.'
  ]);
  for(const n of Object.values(world.npcs||{})){
   if(!n.alive||n.area_id!==p.area_id||
     Math.abs(n.x-p.x)+Math.abs(n.y-p.y)>2)continue;
   const row=document.createElement('div');row.className='dk-skill-row';
   const label=document.createElement('span');
   label.textContent=n.name+' · '+n.role+' · ('+n.x+', '+n.y+')';
   const snoop=button('SNOOP',async()=>{
    try{
     const r=await api.gameAction('snoop_npc',{npc_id:n.id});
     await showThievery({npc_id:n.id,npc_name:n.name,items:r.event?.items||[]});
     feedback(r.event?.text||'Backpack inspected.');
    }catch(error){feedback(error.message);}
   });
   row.append(label,snoop);content.append(row);
  }
  if(observation){
   const title=document.createElement('h3');
   title.className='dk-skill-heading';
   title.textContent='INSPECTED PACK · '+observation.npc_name;
   content.append(title);
   for(const item of observation.items){
    const row=document.createElement('div');row.className='dk-skill-row';
    const label=document.createElement('span');
    label.textContent=item.amount+' × '+item.type+' · '+item.serial;
    const steal=button('PICKPOCKET',async()=>{
     try{
      const r=await api.gameAction('pickpocket',
       {npc_id:observation.npc_id,serial:item.serial});
      await showThievery();
      feedback(r.event?.text||'Pickpocket attempt completed.');
     }catch(error){feedback(error.message);}
    },false);
    row.append(label,steal);content.append(row);
   }
  }
 }catch(error){show('THIEVING',['NPC belongings unavailable: '+error.message]);}
}
menu('THIEVING',()=>showThievery(),'Inspect actual NPC backpacks, take a risk and face living witnesses');

async function showArmory(){
 if(!connected()){show('ARMORY',['Real weapon crafting, equipping and durability require the persistent DK Server.']);return;}
 const api=window.DemonKillerServer;
 try{
  const [gear,inventory]=await Promise.all([api.armory(),api.inventory()]);
  show('ARMORY · WEAPONS & ARMOR',[
   'Your sword, mace, spear or bow changes the combat skill and damage. Bows need arrows and an unobstructed cardinal path.',
   'Shields can block damage; armor absorbs it. All equipped items wear down with use. Unequipping does not repair them.',
   'Craft metal gear at the village smithy using real supplies; arrows and bows use wood and herbs.'
  ]);
  for(const [slot,worn] of Object.entries(gear.equipped||{})){
   const row=document.createElement('div');row.className='dk-skill-row';
   const text=document.createElement('span');text.textContent=slot.toUpperCase()+' · '+
    (worn?worn.type+' · '+worn.durability+'/100':'empty');
   row.append(text);
   if(worn)row.append(button('UNEQUIP',async()=>{
    try{const result=await api.gameAction('unequip_gear',{slot});
     await showArmory();feedback(result.event?.text||'Equipment removed.');
    }catch(error){feedback(error.message);}
   }));
   content.append(row);
  }
  const forgeHeading=document.createElement('h3');forgeHeading.className='dk-skill-heading';
  forgeHeading.textContent='CRAFT PHYSICAL EQUIPMENT';content.append(forgeHeading);
  for(const [name,recipe] of Object.entries(gear.recipes||{})){
   const row=document.createElement('div');row.className='dk-skill-row';
   const label=document.createElement('span');label.textContent=
    name.replaceAll('_',' ')+' · '+Object.entries(recipe.input)
     .map(([type,n])=>n+' '+type).join(', ')+(recipe.smith?' · SMITHY':'');
   row.append(label,button('MAKE',async()=>{
    try{
     const result=await api.gameAction('forge_gear',{recipe:name});
     await showArmory();feedback(result.event?.text||'Equipment crafted.');
    }catch(error){feedback(error.message);}
   }));content.append(row);
  }
  const packHeading=document.createElement('h3');packHeading.className='dk-skill-heading';
  packHeading.textContent='WEAPONS IN YOUR BACKPACK';content.append(packHeading);
  for(const item of inventory.backpack||[]){
   if(!Object.hasOwn(gear.gear||{},item.type))continue;
   const row=document.createElement('div');row.className='dk-skill-row';
   const label=document.createElement('span');label.textContent=
    item.type.replaceAll('_',' ')+' · '+item.serial+' · qty '+item.amount;
   row.append(label,button('EQUIP',async()=>{
    try{
     const result=await api.gameAction('equip_gear',{serial:item.serial});
     await showArmory();feedback(result.event?.text||'Equipment worn.');
    }catch(error){feedback(error.message);}
   },item.amount!==1));
   content.append(row);
  }
 }catch(error){show('ARMORY',['Equipment records unavailable: '+error.message]);}
}
menu('ARMORY',showArmory,'Physical weapons, metalwork, armor, shields and lasting durability');

menu('GUILD',()=>{},'Guild creation and membership are not implemented yet',false);
async function showQuests(){
 if(!connected()){show('QUESTS',['Bounty contracts and their rewards are saved by DK Server. The static GitHub Pages preview does not have an authoritative bounty ledger.']);return;}
 try{
  const result=await window.DemonKillerServer.bounties();
  show('TOWN BOUNTY BOARD',[
   'Active · '+(result.active?result.active.id+' ('+result.active.count+' kills)':'none'),
   'Collected · '+result.total_claimed+' gold',
   'Accept a contract at the issuing shop. Kill the creatures yourself and return to that shop for payment.'
  ]);
  for(const q of result.contracts){
   const row=document.createElement('div');row.className='dk-skill-row';
   const text=document.createElement('span');
   text.textContent=q.name+' · '+q.required+' '+q.kind+
    ' · '+q.reward+' gold · '+q.issuer_name;
   const active=result.active?.id===q.id;
   let action,caption,disabled;
   if(active){
    action='turn_in_bounty';caption='CLAIM';
    disabled=result.active.count<q.required||!q.near_issuer;
   }else{
    action='accept_bounty';caption='ACCEPT';
    disabled=!!result.active||!q.near_issuer;
   }
   const b=button(caption,async()=>{
    try{
     const fields=action==='accept_bounty'?{bounty_id:q.id}:{};
     const event=await window.DemonKillerServer.gameAction(action,fields);
     await showQuests();feedback(event.event?.text||'Bounty updated.');
    }catch(e){feedback(e.message);}
   },disabled);
   b.title=!q.near_issuer?'Travel near '+q.issuer_name+' to use this contract':
    active&&disabled?'Finish the remaining kills':caption+' '+q.name;
   row.append(text,b);content.append(row);
  }
 }catch(error){show('QUESTS',['Bounty ledger unavailable: '+error.message]);}
}
menu('QUESTS',showQuests,'Persistent monster contracts issued by actual town businesses');

menu('PEACE / WAR',()=>{},'Combat stance is not implemented by the server yet',false);
menu('STATUS',async()=>{
 const p=await character(),s=p.crafting||{};
 show('STATUS',[
  'NAME · '+(p.name||'ADVENTURER'),
  'FORM · '+(p.form||'ghost').toUpperCase(),
  'HEALTH · '+(s.health??'unknown')+'  ENERGY · '+(s.energy??'unknown'),
  'MANA · '+(p.magic?.mana??'unknown')+' / '+(p.magic?.max_mana??'unknown'),
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
