'use strict';
// M57 regression for restoring M40's approved first-exit cinematic.
// No browser/visual claims; Node verifies timeline, asset references, and server static access.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const read=pathName=>fs.readFileSync(path.join(root,pathName),'utf8');
const C=require('../dk-lilith-cinematic-m40.js');
const HTML=read('outdoor.html'),JS=read('outdoor.js'),
 TEMPLE=read('test-center.js'),PAPER=read('outdoor-ui.js');
test('M57 reinstates the owner-approved 12-panel source and both distinct branches',()=>{
 assert.equal(C.SHEET,'characters/crystal-woman/transformations/approved-willow-transformations-reference.png');
 assert(fs.existsSync(path.join(root,'assets/art',C.SHEET)));
 assert.equal(C.at(C.PAN+C.WALK+C.PRAYER_TIME+100,'ghost',47).row,0);
 assert.equal(C.at(C.PAN+C.WALK+C.PRAYER_TIME+100,'living',47).row,1);
 for(const form of ['ghost','living'])for(let n=0;n<6;n++){
  const s=C.at(C.PAN+C.WALK+C.PRAYER_TIME+n*C.TRANSFORM/6+15,form,47);
  assert.equal(s.treeFrame,n);assert(!s.playerVisible);
 }
 const top=C.sourceRect({naturalWidth:1774,naturalHeight:887},0,5);
 const bottom=C.sourceRect({naturalWidth:1774,naturalHeight:887},1,5);
 assert(top.sy<bottom.sy&&top.sh===272&&bottom.sh===238);
 assert(JS.includes('CINEMATIC.drawLilith(')&&JS.includes('CINEMATIC.drawTree('));
 assert(!JS.includes('ctx.lineTo(cx+i*15'),'Retired procedural coat-hanger willow must be gone');
});
test('M57 cinematic fully owns camera, player visibility and controls until prayer/return complete',()=>{
 const approach=C.at(C.PAN+C.WALK/2,'ghost',47);
 assert(approach.womanY<41.5&&approach.womanY>28.5);
 assert(approach.cameraY<41.5&&approach.cameraY>28.3);
 const pray=C.at(C.PAN+C.WALK+C.PRAYER_TIME/2,'living',47);
 assert.equal(pray.stage,'prayer');assert(pray.prayer.length>20);
 assert.equal(pray.treeFrame,-1);
 assert.equal(C.PRAYER.length,3);
 assert.equal(C.at(C.TOTAL-20,'ghost',47).playerVisible,false);
 assert(C.at(C.TOTAL,'ghost',47).playerVisible);
 assert(JS.includes("if(lilithPhase==='playing')updateLilith(now)"));
 assert(JS.includes("if(lilithPhase==='playing')return;"));
 assert(JS.includes("if(lilithPhase!=='playing'){"));
 assert(JS.includes('scene.cameraY-VIEW/2'));
 assert(JS.includes('const sheet=ready(CINEMATIC.SHEET);'));
 assert(HTML.includes('id="lilithPrayerText"'));
 assert(HTML.includes('dk-lilith-cinematic-m40.css'));
});
test('M57 replays when earlier broken releases wrongly claimed the first courtyard visit',()=>{
 assert(JS.includes('lilith.completed.m57.server.'));
 assert(JS.includes('lilith.completed.m57.preview.'));
 assert(JS.includes("player.area_id===R.COURT&&"));
 assert(!JS.includes('courtyard_visit_count===1&&'));
 assert(!JS.includes("sessionStorage.setItem('dk.lilith.entry."));
 assert(JS.includes("if(cinematicKey)localStorage.setItem(cinematicKey,'complete')"));
 assert(JS.includes('firstCourtyardSeen:!firstVisit'));
 assert(!JS.includes("setTimeout(()=>{lilithPhase='finished'"));
 const i=JS.indexOf("await refreshSectorInterest();"),j=JS.indexOf("if(firstVisit){\n   // Begin the complete timeline only AFTER");
 assert(i>0&&j>i,'Cutscene timeline must restart after network startup finishes');
 assert(HTML.includes('dk-lilith-cinematic-m40.js?v=m77-calibrated-frames'));
 assert(HTML.includes('outdoor.js?v=0.2.55-lilith-m57'));
});
test('M57 never paints the retired placeholder people underneath the approved character art',()=>{
 const actor=TEMPLE.slice(TEMPLE.indexOf('function playerSprite()'),
  TEMPLE.indexOf('function draw() {',TEMPLE.indexOf('function playerSprite()')));
 assert(actor.includes("characters/'+spriteGroup+'/'+spriteGroup+'_'+p.facing+'.png"));
 assert(!actor.includes("pixel(ctx,"),'Temple player must not draw the obsolete fallback');
 const outdoor=JS.slice(JS.indexOf("if(lilithPhase!=='playing'){"),
  JS.indexOf(' ctx.restore();',JS.indexOf("if(lilithPhase!=='playing'){")));
 assert(!outdoor.includes("px('#342b30'"),'Outdoor player must not draw obsolete underlay');
 const portrait=PAPER.slice(PAPER.indexOf('function drawFigure()'),
  PAPER.indexOf('const symbols=',PAPER.indexOf('function drawFigure()')));
 assert(!portrait.includes('ctx.fillRect('),'Paper doll must wait for the approved sprite');
 const lilith=TEMPLE.slice(TEMPLE.indexOf("if(a.kind==='woman'){"),
  TEMPLE.indexOf("if(a.kind==='member'){",TEMPLE.indexOf("if(a.kind==='woman'){")));
 assert(!lilith.includes("pixel(ctx"),'Temple Lilith must not use the old colored-block silhouette');
});
test('M57 local DK Server explicitly serves the restored script and stylesheet',async()=>{
 const {serveGame}=require('../server/local-game.cjs');
 for(const resource of ['dk-lilith-cinematic-m40.js','dk-lilith-cinematic-m40.css']){
  let status=0,content=null,headers=null;
  const res={writeHead:(s,h)=>{status=s;headers=h;},end:body=>{content=body;}};
  assert.equal(await serveGame({method:'GET'},res,'/'+resource,root),true);
  assert.equal(status,200);
  assert(content?.length>120);
  assert.match(headers['Content-Type'],resource.endsWith('.js')?/javascript/:/text\/css/);
 }
});
