'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDKServer } = require('../server/dk-server.cjs');
const SECRET = 'not-disclosed-to-client-admin-token-1234567';
const PASSWORD = 'correct horse battery staple';
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'dk-owner-auth-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const server = await createDKServer({dataDir:dir,port:0,token:SECRET});
  t.after(() => server.server.listening ? server.close() : Promise.resolve());
  return {server,base:'http://127.0.0.1:' + server.address.port,dir};
}
function call(base,route,data,opts={}) {
  return fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...opts.headers},body:JSON.stringify(data)});
}
function cookie(res) { return res.headers.get('set-cookie')?.split(';')[0]; }

// Session cookies never expose DK Server's administration token; they are
// short-lived, local-only and don't import browser character save data.
test('new local owner setup creates salted credential and an HttpOnly session',async t=>{
  const {base,dir} = await fixture(t);
  const status=await (await fetch(base+'/api/v1/auth/status')).json();
  assert.equal(status.setup_required,true);
  assert.equal(status.authenticated,false);
  assert.equal((await call(base,'/api/v1/auth/setup',{password:'short'})).status,422);
  const setup=await call(base,'/api/v1/auth/setup',{password:PASSWORD});
  assert.equal(setup.status,201);
  assert.match(setup.headers.get('set-cookie'),/HttpOnly/);
  assert.match(setup.headers.get('set-cookie'),/SameSite=Strict/);
  assert.doesNotMatch(setup.headers.get('set-cookie'), new RegExp(SECRET));
  const session=cookie(setup);
  assert.equal((await (await fetch(base+'/api/v1/auth/status',{headers:{Cookie:session}})).json()).authenticated,true);
  const identity=await fs.readFile(path.join(dir,'owner-identity.json'),'utf8');
  assert.doesNotMatch(identity,/correct horse|battery|staple/);
  assert.doesNotMatch(identity,new RegExp(SECRET));
  assert.match(identity,/"salt":"[a-f0-9]{32}"/);
  assert.equal((await call(base,'/api/v1/auth/setup',{password:PASSWORD})).status,409);
  assert.equal((await fetch(base+'/player')).status,200);
  assert.match(await (await fetch(base+'/player.js')).text(),/loadSlots/);
  assert.equal((await fetch(base+'/player.css')).status,200);
});

test('character New Game and Continue use only session authentication and server records',async t=>{
  const {base,dir}=await fixture(t);
  const setup=await call(base,'/api/v1/auth/setup',{password:PASSWORD});
  const session=cookie(setup);
  const unauthorized=await fetch(base+'/api/v1/characters');
  assert.equal(unauthorized.status,401);
  const created=await call(base,'/api/v1/characters',{slot:2,name:'NEWCHAR'},{headers:{Cookie:session}});
  assert.equal(created.status,201);
  const value=await created.json();
  assert.equal(value.character.name,'NEWCHAR');
  assert.equal(value.character.form,'ghost');
  const list=await (await fetch(base+'/api/v1/characters',{headers:{Cookie:session}})).json();
  assert.equal(list.characters['2'].name,'NEWCHAR');
  const continued=await (await fetch(base+'/api/v1/characters/2',{headers:{Cookie:session}})).json();
  assert.equal(continued.character.name,'NEWCHAR');
  assert.equal((await call(base,'/api/v1/characters',{slot:2,name:'HIJACK'},{headers:{Cookie:session}})).status,409);
  assert.equal((await call(base,'/api/v1/characters',{slot:1,name:'EVE',player:{form:'living'}},{headers:{Cookie:session}})).status,422);
  assert.equal((await call(base,'/api/v1/characters',{slot:1,name:'EVE'},{headers:{Cookie:session,Origin:'http://evil.example'}})).status,403);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir,'world.json'),'utf8')).characters['2'].name,'NEWCHAR');
  const logout=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Cookie:session}});
  assert.equal(logout.status,200);
  assert.equal((await fetch(base+'/api/v1/characters',{headers:{Cookie:session}})).status,401);
});

test('owner login survives process restart but prior sessions are not silently trusted',async t=>{
  const {server,base,dir} = await fixture(t);
  const setup=await call(base,'/api/v1/auth/setup',{password:PASSWORD});
  const previousCookie=cookie(setup);
  await server.close();
  const restored=await createDKServer({dataDir:dir,port:0,token:SECRET});
  t.after(()=>restored.server.listening?restored.close():Promise.resolve());
  const newBase='http://127.0.0.1:'+restored.address.port;
  assert.equal((await (await fetch(newBase+'/api/v1/auth/status')).json()).setup_required,false);
  assert.equal((await (await fetch(newBase+'/api/v1/auth/status',{headers:{Cookie:previousCookie}})).json()).authenticated,false);
  const invalid=await call(newBase,'/api/v1/auth/login',{password:'bad password'});
  assert.equal(invalid.status,401);
  const login=await call(newBase,'/api/v1/auth/login',{password:PASSWORD});
  assert.equal(login.status,200);
  assert.equal((await (await fetch(newBase+'/api/v1/auth/status',{headers:{Cookie:cookie(login)}})).json()).authenticated,true);
  await restored.close();
});

test('owner password rate limits guesses and setup cannot be raced',async t=>{
  const {base}=await fixture(t);
  const results=await Promise.all([
    call(base,'/api/v1/auth/setup',{password:PASSWORD}),
    call(base,'/api/v1/auth/setup',{password:'another long and good password'})
  ]);
  assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);
  for(let n=0;n<5;n++)assert.equal((await call(base,'/api/v1/auth/login',{password:'wrong password'})).status,401);
  assert.equal((await call(base,'/api/v1/auth/login',{password:PASSWORD})).status,429);
  assert.equal((await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Origin:'http://evil.example'}})).status,403);
});
