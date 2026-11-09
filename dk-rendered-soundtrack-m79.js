/* DK Softworks M79: loop-point-aware MP3 transport with original MIDI fallback.
 * MP3 renders the original MIDI score. Both sources represent the same
 * composition, never a different or previously retired soundtrack.
 */
(function(root){
'use strict';
function create({url,midiUrl,volume=100,baseGain=.4,loopStart=0,loopEnd=0,startAt=0}={}){
 if(!url||!midiUrl)throw Error('Original MP3 and MIDI paths are required');
 let level=Math.max(0,Math.min(200,Number(volume)||0)),enabled=false;
 let context=null,source=null,gain=null,midi=null,working=null,token=0;
 let lastError=null;
 function volumeNow(){
  if(gain&&context)gain.gain.setTargetAtTime(baseGain*level/100,context.currentTime,.025);
  midi?.setVolume(level);
 }
 function cleanup(){
  token++;working=null;
  if(source){try{source.stop();}catch(_){}source.disconnect();source=null;}
  midi?.stop();midi=null;
  if(context){const old=context;context=null;gain=null;void old.close().catch(()=>{});}
 }
 function stop(){enabled=false;cleanup();}
 function setVolume(n){level=Math.max(0,Math.min(200,Number(n)||0));volumeNow();}
 async function play(){
  enabled=true;
  if(source){
   if(context?.state==='suspended')void context.resume().catch(()=>{});
   return true;
  }
  if(midi){void midi.play();return true;}
  if(working)return working;
  const id=++token;
  const task=(async()=>{
   try{
    const Context=root.AudioContext||root.webkitAudioContext;
    if(!Context)throw Error('WebAudio is unavailable');
    const local=new Context();context=local;
    const response=await fetch(url);
    if(!response.ok)throw Error('Original rendered track unavailable: '+response.status);
    const data=await response.arrayBuffer();
    const buffer=await local.decodeAudioData(data);
    if(id!==token||!enabled)return false;
    if(buffer.duration<Math.max(90,loopEnd||0))throw Error('Rendered MP3 is incomplete');
    const start=Math.max(0,Math.min(Number(startAt)||0,buffer.duration-.1));
    const from=Math.max(0,Math.min(Number(loopStart)||0,buffer.duration-.2));
    const to=Math.max(from+.1,Math.min(Number(loopEnd)||buffer.duration,buffer.duration-.05));
    source=local.createBufferSource();source.buffer=buffer;source.loop=true;
    source.loopStart=from;source.loopEnd=to;
    gain=local.createGain();gain.gain.value=baseGain*level/100;
    source.connect(gain);gain.connect(local.destination);
    source.start(0,start);
    void local.resume().catch(()=>{});
    return true;
   }catch(err){
    lastError=err;
    if(id!==token||!enabled)return false;
    if(context){const old=context;context=null;gain=null;void old.close().catch(()=>{});}
    // The exact new score, never the old organ or old overworld tune.
    midi=root.DKMidiSoundtrack?.create({
     url:midiUrl,volume:level,baseGain,loop:true,
     loopFromSeconds:loopStart,startAtSeconds:startAt
    })||null;
    return midi?await midi.play():false;
   }
  })();
  working=task;
  try{return await task;}finally{if(working===task)working=null;}
 }
 return Object.freeze({play,stop,setVolume,
  get playing(){return Boolean((source&&context?.state==='running')||midi?.playing);},
  get fallback(){return Boolean(midi);},
  get lastError(){return lastError?.message||null;}
 });
}
root.DKRenderedSoundtrack=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
