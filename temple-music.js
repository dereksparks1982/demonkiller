/* DK Softworks | Temple soundtrack controller.
 * The legacy temple organ arrangement is retired. Do not fetch, play or
 * resume it, including after the opening cue ends.
 * The complete 90+ second original replacement remains a separate asset task.
 */
(function(){
  'use strict';
  const PREFS_KEY='dkSoftworks.demonkiller.menuPrefs.v1';
  const EXECUTION_URL='./assets/audio/music/demon-killer-the-last-breath-v1.mid';
  const button=document.getElementById('templeMusicToggle');
  let enabled=true, executionPlayer=null, executionMode=false;
  try{
    const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'null');
    if(prefs&&typeof prefs.musicEnabled==='boolean')enabled=prefs.musicEnabled;
  }catch(_){}
  function updateButton(){
    if(!button)return;
    button.textContent=enabled?'♪ MUSIC ON':'♪ MUSIC OFF';
    button.setAttribute('aria-pressed',String(enabled));
  }
  function stopPlayer(){
    if(executionPlayer){executionPlayer.stop();executionPlayer=null;}
  }
  function beginExecution(){
    executionMode=true;
    stopPlayer();
    if(!enabled)return;
    executionPlayer=window.DKMidiSoundtrack?.create({
      url:EXECUTION_URL,volume:100,baseGain:.48,loop:false
    })||null;
    void executionPlayer?.play();
  }
  function finishExecution(){
    executionMode=false;
    stopPlayer();
    // Deliberately silent. Never restart the retired temple soundtrack.
  }
  function savePreference(){
    try{
      const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{};
      prefs.musicEnabled=enabled;
      localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
    }catch(_){}
  }
  if(button)button.addEventListener('click',()=>{
    enabled=!enabled;
    savePreference();updateButton();
    if(!enabled)stopPlayer();
    else if(executionMode)beginExecution();
  });
  function retry(){
    if(enabled&&executionMode&&executionPlayer&&!executionPlayer.playing)
      void executionPlayer.play();
  }
  document.addEventListener('pointerdown',retry,{passive:true});
  document.addEventListener('keydown',retry);
  window.addEventListener('pagehide',stopPlayer);
  window.DKTempleMusic=Object.freeze({beginExecution,finishExecution});
  updateButton();
}());
