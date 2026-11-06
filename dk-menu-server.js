/* DK Softworks: the persistent world runs in the local game process. */
(function(){
'use strict';
const origin=window.location;
if(!origin||origin.protocol!=='http:'||!['127.0.0.1','localhost','::1','[::1]'].includes(origin.hostname))return;
const $=id=>document.getElementById(id);
async function request(route,init={}){
 const res=await fetch(route,{credentials:'same-origin',cache:'no-store',...init});
 let data;
 try{data=await res.json();}
 catch(_){throw Error('DK Server returned an invalid response');}
 if(!res.ok)throw Error(data.error||'DK Server error '+res.status);
 return data;
}
const post=(route,body)=>request(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const client={
 async listCharacters(){return(await request('/api/v1/characters')).characters;},
 async createCharacter(slot,name){return(await post('/api/v1/characters',{slot,name})).character;},
 async getCharacter(slot){return(await request('/api/v1/characters/'+slot)).character;},
 async action(slot,action,fields={}){return(await post('/api/v1/characters/'+slot+'/actions',{action,...fields})).character;},
 async health(){return request('/api/v1/health');},
 async clock(){return request('/api/v1/clock');},
 async world(){return request('/api/v1/world');},
 async shutdown(){return request('/api/v1/server/shutdown',{method:'POST',headers:{'X-DK-Control':'shutdown'}});}
};
window.DemonKillerServer=Object.freeze(client);
const panel=$('dkServerOptions');
if(!panel)return; // The same client API is also used by the playable temple.
panel.hidden=false;
const indicator=$('dkServerStatus'),stop=$('dkServerStop');
const display=message=>{indicator.textContent=message;};
async function refresh(){
 try{
  const [health,clock]=await Promise.all([client.health(),client.clock()]);
  if(health.build!=='local-m3')throw Error('Restart the older DK Server to load this build');
  display('RUNNING · '+clock.phase.toUpperCase()+' · '+Math.ceil(clock.seconds_until_transition/60)+
    ' minutes until '+(clock.phase==='day'?'night':'day')+
    '. Closing Firefox will NOT stop the world.');
  stop.disabled=false;
 }catch(e){display('NOT CONNECTED · '+e.message);stop.disabled=true;}
}
stop.addEventListener('click',async()=>{
 if(!window.confirm('Shut down DK Server and stop the persistent world?'))return;
 stop.disabled=true;
 try{await client.shutdown();display('SERVER STOPPING · Pending world writes will finish before exit.');}
 catch(e){display('SHUTDOWN FAILED · '+e.message);stop.disabled=false;}
});
document.querySelector('[data-action=options]')?.addEventListener('click',refresh);
refresh();
})();
