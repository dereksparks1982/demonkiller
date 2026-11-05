/* Demon Killer: deterministic society population and schedules.
 * Public records are separate from actual cult membership and discovered clues.
 * Generic generated citizens are placeholders for future authored locations.
 */
(function(root, build) {
  'use strict';
  const api=build();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DemonKillerPopulation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1;
  const FIRST=['Ada','Mara','Elian','Jonas','Miriam','Gideon','Elena','Silas',
    'Iris','Cassian','Nora','Edwin','Lydia','Tobias','Rowan','Clara',
    'Vera','Alaric','Esther','Bastian','Dahlia','Lucan','Ophelia','Abel',
    'Maude','Felix','Selene','Nolan','Ansel','Beatrice','Judith','Dorian'];
  const LAST=['Vale','Ashford','Morrow','Bell','Marsh','Hale','Wren','Mercer',
    'Thorne','Ward','Fenn','Blackwell','Sutton','Grey','Locke','Voss',
    'Tanner','Alder','Merrick','Byrne','Quill','Pryce','Mason','Reed',
    'West','Farrow','Rowe','Carver','Rook','Hart','Crest','Wyatt'];
  const JOBS=Object.freeze([
    ['magistrate','Magistrate',true,9,17],
    ['council_clerk','Council Clerk',true,8,16],
    ['physician','Physician',true,8,18],
    ['treasurer','Guild Treasurer',true,9,17],
    ['merchant','Merchant',true,7,18],
    ['apothecary','Apothecary',true,8,19],
    ['watch_captain','Watch Captain',true,7,16],
    ['innkeeper','Innkeeper',true,14,1],
    ['archivist','Archivist',true,9,17],
    ['schoolteacher','Schoolteacher',true,8,15],
    ['steward','Steward',true,8,18],
    ['notary','Notary',true,9,16],
    ['stonemason','Stonemason',false,6,16],
    ['ferryman','Ferryman',false,5,17],
    ['stablekeeper','Stablekeeper',false,6,19],
    ['tailor','Tailor',false,9,18],
    ['grocer','Grocer',false,7,18],
    ['groundskeeper','Groundskeeper',false,6,16],
    ['night_watch','Night Watchman',false,20,6],
    ['undertaker','Undertaker',false,9,18],
    ['bell_keeper','Bell Keeper',false,6,15],
    ['courier','Courier',false,6,20],
    ['locksmith','Locksmith',false,9,18],
    ['market_porter','Market Porter',false,5,16]
  ]);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function hash(input) {
    let h=2166136261;
    for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
    h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;
    h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0;
  }
  const roll=(seed,key)=>hash(seed+'|'+key)/4294967296;
  const clamp=v=>Math.max(0,Math.min(1,v));
  const deepClone=o=>JSON.parse(JSON.stringify(o));
  function validate(pop){
    return !!(pop&&pop.version===VERSION&&typeof pop.seed==='string'&&
      Number.isInteger(pop.hour)&&pop.hour>=0&&pop.hour<24&&
      Number.isInteger(pop.day)&&pop.day>=0&&
      pop.people&&typeof pop.people==='object'&&!Array.isArray(pop.people)&&
      Array.isArray(pop.order)&&pop.order.length===JOBS.length&&
      pop.order.every(id=>typeof id==='string'&&own(pop.people,id)));
  }
  function must(pop){if(!validate(pop))throw Error('Invalid population state.');}
  function create(seed){
    const world={version:VERSION,seed:String(seed),day:0,hour:9,
      people:Object.create(null),order:[]};
    const names=new Set();
    for(const [idx,[key,occupation,prominent,start,end]] of JOBS.entries()){
      const id='citizen_'+key;
      let name='';
      for(let n=0;n<96;n++){
        const f=FIRST[Math.floor(roll(world.seed,id+':first:'+n)*FIRST.length)];
        const l=LAST[Math.floor(roll(world.seed,id+':last:'+n)*LAST.length)];
        name=f+' '+l;
        if(!names.has(name))break;
      }
      names.add(name);
      const traits={
        ambition:+clamp(0.12+0.84*roll(world.seed,id+':ambition')).toFixed(3),
        greed:+clamp(0.1+0.8*roll(world.seed,id+':greed')).toFixed(3),
        fear:+clamp(0.1+0.8*roll(world.seed,id+':fear')).toFixed(3),
        belief:+clamp(0.1+0.8*roll(world.seed,id+':belief')).toFixed(3)
      };
      world.people[id]={id,name,occupation,prominent,traits,contacts:[],
        schedule:{start,end},kind:'procedural'};
      world.order.push(id);
    }
    // A stable, reciprocal web of acquaintances. These are social contacts,
    // not evidence of cult membership.
    for(let i=0;i<world.order.length;i++)for(let j=i+1;j<world.order.length;j++){
      const x=world.order[i],y=world.order[j];
      if(roll(world.seed,'contact:'+x+':'+y)<0.13){
        world.people[x].contacts.push(y);
        world.people[y].contacts.push(x);
      }
    }
    return world;
  }
  function get(pop,id){must(pop);if(!own(pop.people,id))throw Error('Unknown citizen.');
    return pop.people[id];}
  function hours(shift){
    const {start,end}=shift;
    return String(start).padStart(2,'0')+':00–'+String(end).padStart(2,'0')+':00';
  }
  function publicRecord(pop,id){
    const p=get(pop,id);
    return {id:p.id,name:p.name,occupation:p.occupation,prominent:p.prominent,
      listedHours:hours(p.schedule)};
  }
  function publicRegister(pop){must(pop);
    return pop.order.map(id=>publicRecord(pop,id));}
  function profiles(pop){must(pop);return pop.order.map(id=>{
    const p=pop.people[id];
    return {id:p.id,name:p.name,occupation:p.occupation,prominent:p.prominent,
      traits:deepClone(p.traits),ties:p.contacts.slice(),eligible:true};
  });}
  function onDuty(shift,hour) {
    return shift.start<shift.end
      ?hour>=shift.start&&hour<shift.end
      :hour>=shift.start||hour<shift.end;
  }
  function whereabouts(pop,id){
    const p=get(pop,id),h=pop.hour;
    let activity,setting;
    if(onDuty(p.schedule,h)){activity='working';setting='workplace';}
    else if(h>=18&&h<22&&roll(pop.seed,id+':evening')<0.6){
      activity='socializing';setting='public';}
    else {activity='resting';setting='home';}
    // Abstract location labels are placeholders, not built map destinations.
    return {id,name:p.name,day:pop.day,hour:h,activity,setting};
  }
  function advanceHours(pop,hoursToAdvance=1){
    must(pop);
    if(!Number.isInteger(hoursToAdvance)||hoursToAdvance<1||hoursToAdvance>168)
      throw Error('Advance must be 1 to 168 whole hours.');
    const total=pop.hour+hoursToAdvance;
    pop.day+=Math.floor(total/24);pop.hour=total%24;
    return {day:pop.day,hour:pop.hour};
  }
  function restore(raw){must(raw);return deepClone(raw);}
  return Object.freeze({VERSION,COUNT:JOBS.length,create,validate,restore,
    profiles,publicRecord,publicRegister,whereabouts,advanceHours});
});