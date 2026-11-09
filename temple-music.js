/* Demon Killer: standalone MIDI-to-WebAudio organ player for the Forsaken Temple.
 * The owner-supplied Fire Emblem arrangement is temporary development audio only.
 * Do not commercially ship without clearing the composition and arrangement rights.
 */
(function () {
  'use strict';
  const PREFS_KEY='dkSoftworks.demonkiller.menuPrefs.v1';
  const MUSIC_URL='./assets/audio/music/lyon-organ-arrangement.mid';
  const button=document.getElementById('templeMusicToggle');
  const EXECUTION_URL='./assets/audio/music/demon-killer-the-last-breath-v1.mid';
  let executionMode=false, executionPlayer=null;
  function beginExecution(){
    executionMode=true;
    if(executionPlayer)executionPlayer.stop();
    executionPlayer=window.DKMidiSoundtrack?.create({
      url:EXECUTION_URL,volume:100,baseGain:.48,loop:false
    })||null;
    // The existing temple organ must not play over the new execution score.
    void stop();
    if(enabled)void executionPlayer?.play();
  }
  function finishExecution(){
    if(!executionMode)return;
    executionMode=false;
    executionPlayer?.stop();
    executionPlayer=null;
    if(enabled)void resume();
  }
  window.DKTempleMusic=Object.freeze({beginExecution,finishExecution});
  let enabled=true, ctx=null, output=null, wave=null, notes=null, length=0, timer=null;
  let noteIndex=0, loopStart=0, voices=new Set(), loading=null;
  try{const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'null');
    if(prefs&&typeof prefs.musicEnabled==='boolean')enabled=prefs.musicEnabled;
  }catch(error){/* Preference is optional. */}
  function updateButton(){
    if(button){button.textContent=enabled?'♪ MUSIC ON':'♪ MUSIC OFF';
      button.setAttribute('aria-pressed',String(enabled));}
  }
  function parseMidi(arrayBuffer){
    const bytes=new Uint8Array(arrayBuffer), dv=new DataView(arrayBuffer);
    let i=0; const read8=()=>bytes[i++], read16=()=>{const n=dv.getUint16(i);i+=2;return n;};
    const read32=()=>{const n=dv.getUint32(i);i+=4;return n;};
    const str=n=>{let s='';while(n--)s+=String.fromCharCode(read8());return s;};
    const variable=()=>{let n=0,b=0;do{b=read8();n=(n<<7)|(b&127);}while(b&128);return n;};
    if(str(4)!=='MThd')throw Error('Invalid MIDI header');
    const headerLen=read32(); read16(); const tracks=read16(),division=read16();
    if(division&0x8000)throw Error('SMPTE timing is not supported');
    i=8+headerLen;
    const events=[];let endTick=0;
    for(let track=0;track<tracks;track++){
      if(str(4)!=='MTrk')throw Error('Invalid MIDI track');
      const trackLen=read32(),end=i+trackLen;let tick=0,running=0;
      while(i<end){
        tick+=variable();
        let status=bytes[i];
        if(status&128){i++;if(status<240)running=status;}else status=running;
        if(!status)throw Error('Invalid MIDI running status');
        if(status===255){
          const kind=read8(),size=variable();
          if(kind===81&&size===3){const tempo=(read8()<<16)|(read8()<<8)|read8();
            events.push({tick,kind:'tempo',tempo});}
          else i+=size;
        }else if(status===240||status===247){i+=variable();}
        else{
          const type=status&240,channel=status&15,first=read8();
          const second=(type===192||type===208)?0:read8();
          if(type===144&&second>0)events.push({tick,kind:'on',key:track+':'+channel+':'+first,pitch:first,velocity:second});
          else if(type===128||(type===144&&second===0))events.push({tick,kind:'off',key:track+':'+channel+':'+first});
        }
      }
      endTick=Math.max(endTick,tick);i=end;
    }
    const order={tempo:0,off:1,on:2};
    events.sort((a,b)=>a.tick-b.tick||order[a.kind]-order[b.kind]);
    const active=new Map(), result=[];let prev=0,elapsed=0,tempo=500000;
    for(const e of events){
      elapsed+=(e.tick-prev)*tempo/(1000000*division);prev=e.tick;
      if(e.kind==='tempo')tempo=e.tempo;
      else if(e.kind==='on')active.set(e.key,{start:elapsed,pitch:e.pitch,velocity:e.velocity});
      else if(active.has(e.key)){
        const n=active.get(e.key);active.delete(e.key);
        result.push({at:n.start,duration:Math.max(.07,elapsed-n.start),pitch:n.pitch,velocity:n.velocity});
      }
    }
    elapsed+=(endTick-prev)*tempo/(1000000*division);
    result.sort((a,b)=>a.at-b.at);
    return {notes:result,length:Math.max(elapsed,...result.map(n=>n.at+n.duration))};
  }
  async function prepare(){
    if(notes)return true;
    if(!loading)loading=fetch(MUSIC_URL).then(r=>{
      if(!r.ok)throw Error('MIDI download failed: '+r.status);
      return r.arrayBuffer();
    }).then(buffer=>{const song=parseMidi(buffer);notes=song.notes;length=song.length;return true;})
      .catch(error=>{console.warn('Demon Killer temple music unavailable:',error);return false;});
    return loading;
  }
  function playNote(n,time){
    if(!ctx||!output)return;
    const osc=ctx.createOscillator(),env=ctx.createGain();
    osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(440*Math.pow(2,(n.pitch-69)/12),time);
    const end=time+n.duration,level=.095*(n.velocity/127);
    env.gain.setValueAtTime(0,time);
    env.gain.linearRampToValueAtTime(level,time+Math.min(.045,n.duration/3));
    env.gain.setValueAtTime(level,Math.max(time+.045,end-.09));
    env.gain.linearRampToValueAtTime(.0001,end+.10);
    osc.connect(env);env.connect(output);
    voices.add(osc);
    osc.onended=()=>{voices.delete(osc);osc.disconnect();env.disconnect();};
    osc.start(time);osc.stop(end+.12);
  }
  function schedule(){
    if(!ctx||!enabled||!notes||!notes.length)return;
    const horizon=ctx.currentTime+.45;
    while(loopStart+notes[noteIndex].at<horizon){
      const n=notes[noteIndex],at=loopStart+n.at;
      if(at>=ctx.currentTime-.10)playNote(n,Math.max(at,ctx.currentTime+.005));
      noteIndex++;
      if(noteIndex===notes.length){noteIndex=0;loopStart+=length;}
      if(loopStart-ctx.currentTime>length+1)break;
    }
  }
  async function resume(){
    if(!enabled||!window.AudioContext&&!window.webkitAudioContext)return;
    if(executionMode){if(executionPlayer&&!executionPlayer.playing)await executionPlayer.play();return;}
    if(!await prepare()||!enabled||executionMode)return;
    if(!ctx){
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      ctx=new AudioContextClass();output=ctx.createGain();
      output.gain.value=.21;output.connect(ctx.destination);
      // Quiet organ-like harmonic stack; all four MIDI voices use the same timbre.
      wave=ctx.createPeriodicWave(new Float32Array([0,0,0,0,0,0]),
        new Float32Array([0,1,.34,.17,.09,.04]));
      loopStart=ctx.currentTime+.07;noteIndex=0;
    }
    try{await ctx.resume();}catch(error){return;}
    if(!timer){schedule();timer=setInterval(schedule,110);}
  }
  async function stop(){
    if(timer){clearInterval(timer);timer=null;}
    for(const osc of voices){try{osc.stop();}catch(error){}}
    voices.clear();
    if(ctx){const old=ctx;ctx=null;output=null;wave=null;
      try{await old.close();}catch(error){}}
  }
  function savePreference(){
    try{const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{};
      prefs.musicEnabled=enabled;localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
    }catch(error){/* Storage may be disabled. */}
  }
  if(button)button.addEventListener('click',()=>{
    enabled=!enabled;savePreference();updateButton();
    if(enabled)resume();else {executionPlayer?.stop();stop();}
  });
  document.addEventListener('pointerdown',()=>{if(enabled)resume();},{passive:true});
  document.addEventListener('keydown',()=>{if(enabled)resume();});
  window.addEventListener('pagehide',()=>{executionPlayer?.stop();stop();});
  updateButton();resume();
}());
