/* DK Softworks | Original MIDI soundtrack player for menu and overworld.
 * No external libraries, soundfonts, remote assets, or prerecorded playback.
 * One player instance per page; releases voices and AudioContext on page exit.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DKMidiSoundtrack=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
function parseMidi(buffer){
 const data=new DataView(buffer), bytes=new Uint8Array(buffer);
 let i=0;
 const u8=()=>{if(i>=bytes.length)throw Error('Truncated MIDI');return bytes[i++];};
 const u16=()=>{const v=data.getUint16(i);i+=2;return v;};
 const u32=()=>{const v=data.getUint32(i);i+=4;return v;};
 const str=n=>Array.from({length:n},()=>String.fromCharCode(u8())).join('');
 const vlq=()=>{let v=0,b;do{b=u8();v=(v<<7)|(b&127);}while(b&128);return v;};
 if(str(4)!=='MThd')throw Error('Not a MIDI file');
 const headerLength=u32(),format=u16(),trackCount=u16(),division=u16();
 if(division&0x8000||format===2)throw Error('Unsupported MIDI timing');
 i=8+headerLength;
 const tempos=[{tick:0,value:500000}],rawNotes=[];let endTick=0;
 for(let t=0;t<trackCount;t++){
  if(str(4)!=='MTrk')throw Error('Invalid MIDI track');
  const trackLength=u32(),end=i+trackLength;if(end>bytes.length)throw Error('Invalid MIDI track length');
  let tick=0,running=0;
  const programs=Array(16).fill(0),levels=Array(16).fill(100),active=new Map();
  while(i<end){
   tick+=vlq();let status=bytes[i];
   if(status&128){i++;if(status<240)running=status;}
   else status=running;
   if(!status)throw Error('Missing MIDI running status');
   if(status===255){
    const type=u8(),length=vlq();
    if(type===81&&length===3)tempos.push({tick,value:(u8()<<16)|(u8()<<8)|u8()});
    else i+=length;
   }else if(status===240||status===247)i+=vlq();
   else{
    const type=status&240,ch=status&15,pitch=u8();
    const vel=type===192||type===208?0:u8();
    if(type===192)programs[ch]=pitch;
    else if(type===176&&pitch===7)levels[ch]=vel;
    else if(type===144&&vel){
     const key=ch+':'+pitch;
     if(!active.has(key))active.set(key,[]);
     active.get(key).push({start:tick,channel:ch,pitch,velocity:vel,
      program:programs[ch],level:levels[ch]});
    }else if(type===128||(type===144&&!vel)){
     const key=ch+':'+pitch,stack=active.get(key);
     if(stack?.length){const note=stack.shift();rawNotes.push({...note,end:tick});}
    }
   }
  }
  if(i!==end)throw Error('Invalid MIDI event');
  endTick=Math.max(endTick,tick);
 }
 tempos.sort((a,b)=>a.tick-b.tick);
 let tempo=500000,prev=0,elapsed=0;
 for(const e of tempos){elapsed+=(e.tick-prev)*tempo/(division*1000000);prev=e.tick;tempo=e.value;e.seconds=elapsed;}
 function seconds(tick){
  let left=0,right=tempos.length-1;
  while(left<right){const middle=Math.ceil((left+right)/2);
   if(tempos[middle].tick<=tick)left=middle;else right=middle-1;}
  const base=tempos[left];
  return base.seconds+(tick-base.tick)*base.value/(division*1000000);
 }
 const notes=rawNotes.map(n=>({at:seconds(n.start),
  duration:Math.max(.04,seconds(n.end)-seconds(n.start)),
  pitch:n.pitch,velocity:n.velocity,channel:n.channel,
  program:n.program,level:n.level})).sort((a,b)=>a.at-b.at);
 const length=seconds(endTick);
 if(!notes.length||!Number.isFinite(length)||length<=0)throw Error('Empty MIDI');
 return {notes,length};
}
function create({url,volume=100,baseGain=.28,loop=true,loopFromSeconds=0,startAtSeconds=0}={}){
 if(!url)throw Error('MIDI URL required');
 let enabled=false,ctx=null,output=null,timer=null,notes=null,length=0;
 let voices=new Set(),loading=null,position=0,cycleStart=0,generation=0,finished=false;
 let loopIndex=0,startIndex=0,loopOffset=0;
 let volumePercent=Math.max(0,Math.min(200,Number(volume)||0));
 async function load(){
  if(notes)return true;
  if(!loading)loading=fetch(url).then(r=>{
   if(!r.ok)throw Error('MIDI unavailable: '+r.status);
   return r.arrayBuffer();
  }).then(b=>{
   const parsed=parseMidi(b);notes=parsed.notes;length=parsed.length;
   loopOffset=Math.max(0,Math.min(length-.01,Number(loopFromSeconds)||0));
   const startingAt=Math.max(0,Math.min(length-.01,Number(startAtSeconds)||0));
   loopIndex=Math.max(0,notes.findIndex(n=>n.at>=loopOffset));
   startIndex=Math.max(0,notes.findIndex(n=>n.at>=startingAt));
   return true;
  })
    .catch(e=>{loading=null;console.warn('DK soundtrack unavailable',url,e);return false;});
  return loading;
 }
 function setVolume(percent){
  volumePercent=Math.max(0,Math.min(200,Number(percent)||0));
  if(output&&ctx)output.gain.setTargetAtTime(baseGain*volumePercent/100,ctx.currentTime,.02);
 }
 function playNote(n,at){
  if(!ctx||!output)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  const drum=n.channel===9;
  if(drum){osc.type='triangle';osc.frequency.value=n.pitch===35||n.pitch===36?72:210+(n.pitch%12)*32;}
  else{
   const p=n.program;
   osc.type=(p>=80&&p<=85)?'square':
    (p>=40&&p<=55)?'sawtooth':
    (p===10||p===14||p===19)?'sine':'triangle';
   osc.frequency.value=440*Math.pow(2,(n.pitch-69)/12);
  }
  const duration=drum?Math.min(.16,n.duration):n.duration;
  const attack=drum?.003:(n.program>=40&&n.program<=55?.10:.018);
  const release=drum?.06:(n.program===14||n.program===10?.15:.18);
  const peak=(drum?.034:n.program>=40&&n.program<=55?.031:.052)*
   (n.velocity/127)*(n.level/100);
  const end=at+duration;
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.linearRampToValueAtTime(peak,at+Math.min(attack,duration/2));
  if(!drum)gain.gain.setValueAtTime(peak,Math.max(at+Math.min(attack,duration/2),end-.065));
  gain.gain.exponentialRampToValueAtTime(.0001,end+release);
  osc.connect(gain);gain.connect(output);
  voices.add(osc);
  osc.onended=()=>{voices.delete(osc);try{osc.disconnect();gain.disconnect();}catch(_){}};
  osc.start(at);osc.stop(end+release+.015);
 }
 function schedule(){
  if(!ctx||!enabled||!notes?.length||finished)return;
  if(cycleStart<ctx.currentTime-length-1){
   position=loop&&loopOffset>0?loopIndex:0;
   cycleStart=ctx.currentTime+.07-notes[position].at;
  }
  const horizon=ctx.currentTime+.35;
  let cap=0;
  while(cycleStart+notes[position].at<horizon&&cap++<256){
   const n=notes[position],at=cycleStart+n.at;
   if(at>=ctx.currentTime-.06)playNote(n,Math.max(at,ctx.currentTime+.005));
   position++;
   if(position===notes.length){
    if(!loop){finished=true;if(timer){clearInterval(timer);timer=null;}break;}
    position=loopIndex;cycleStart+=length-loopOffset;
   }
  }
 }
 async function play(){
  if(!loop&&finished)return false;
  enabled=true;const ticket=++generation;
  if(!await load()||!enabled||ticket!==generation)return false;
  const Context=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  if(typeof Context!=='function')return false;
  if(!ctx){
   ctx=new Context();output=ctx.createGain();
   const limiter=ctx.createDynamicsCompressor();
   limiter.threshold.value=-7;limiter.ratio.value=12;
   limiter.attack.value=.003;limiter.release.value=.2;
   output.connect(limiter);limiter.connect(ctx.destination);
   position=startIndex;cycleStart=ctx.currentTime+.10-notes[startIndex].at;setVolume(volumePercent);
  }
  try{await ctx.resume();}catch(_){return false;}
  if(!enabled||ticket!==generation)return false;
  if(!timer){schedule();timer=setInterval(schedule,100);}
  return true;
 }
 function stop(){
  enabled=false;generation++;finished=false;position=0;
  if(timer){clearInterval(timer);timer=null;}
  for(const osc of voices){try{osc.stop();}catch(_){}}
  voices.clear();
  if(ctx){const old=ctx;ctx=null;output=null;void old.close().catch(()=>{});}
 }
 return Object.freeze({play,stop,setVolume,get playing(){return enabled&&!!timer;}});
}
return Object.freeze({parseMidi,create});
});