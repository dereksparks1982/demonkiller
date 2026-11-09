/* DK Softworks M79 | The Last Breath. One original score, no old organ.
 * Intro 0–24 seconds plays once; atmospheric 24–108 seconds loops until exit.
 * Cutscene completion and resurrection choice never interrupt the music.
 */
(function(){
'use strict';
const PREFS_KEY='dkSoftworks.demonkiller.menuPrefs.v1';
const button=document.getElementById('templeMusicToggle');
let enabled=true,opening=false,player=null;
try{const p=JSON.parse(localStorage.getItem(PREFS_KEY)||'null');
 if(p&&typeof p.musicEnabled==='boolean')enabled=p.musicEnabled;
}catch(_){}
function display(){
 if(button){button.textContent=enabled?'♪ MUSIC ON':'♪ MUSIC OFF';
  button.setAttribute('aria-pressed',String(enabled));}
}
function volume(){
 try{const p=JSON.parse(localStorage.getItem(PREFS_KEY)||'null');
  if(Number.isFinite(p?.volumePercent))return p.volumePercent;
 }catch(_){}
 return 100;
}
function start(at){
 player?.stop();player=null;
 if(!enabled)return;
 player=window.DKRenderedSoundtrack?.create({
  url:'./assets/audio/music/demon-killer-the-last-breath-v2.mp3',
  midiUrl:'./assets/audio/music/demon-killer-the-last-breath-v2.mid',
  startAt:at,loopStart:24,loopEnd:108,
  volume:volume(),baseGain:.42
 })||null;
 void player?.play();
}
function beginExecution(){opening=true;start(0);}
function finishExecution(){
 opening=false;
 // Keep exactly the same score playing after Lilith leaves.
 if(enabled&&!player)start(24);
}
function startAmbient(){
 if(opening)return;
 if(enabled&&!player)start(24);
}
if(button)button.addEventListener('click',()=>{
 enabled=!enabled;
 try{const p=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{};
  p.musicEnabled=enabled;localStorage.setItem(PREFS_KEY,JSON.stringify(p));
 }catch(_){}
 display();
 if(!enabled){player?.stop();player=null;}
 else start(opening?0:24);
});
function wake(){
 if(!enabled)return;
 if(!player&&!opening)start(24);
 else if(player)void player.play();
}
document.addEventListener('pointerdown',wake,{passive:true});
document.addEventListener('keydown',wake);
window.addEventListener('pagehide',()=>{player?.stop();player=null;});
window.DKTempleMusic=Object.freeze({beginExecution,finishExecution,startAmbient});
display();
}());
