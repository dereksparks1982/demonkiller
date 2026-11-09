'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const scene=require('../dk-lilith-cinematic-m40.js');
const file=p=>readFileSync(path.join(__dirname,'..',p),'utf8');

test('M40 only approved transformation artwork is referenced; no primitive tree substitute',()=>{
 const outdoor=file('outdoor.js');
 assert(outdoor.includes('CINEMATIC.drawTree('));
 assert(outdoor.includes('CINEMATIC.drawLilith('));
 assert(!outdoor.includes('ctx.lineTo(cx+i*15'));
 assert(!outdoor.includes('if(amount<.4)return'));
 assert.equal(scene.SHEET,'characters/crystal-woman/transformations/approved-willow-transformations-reference.png');
 const html=file('outdoor.html');
 assert(html.includes('dk-lilith-cinematic-m40.js'));
 assert(html.includes('id="lilithPrayer"'));
 assert(html.includes('id="lilithPrayerText"'));
});

test('M40 camera follows Lilith north while player is invisible and unable to move',()=>{
 const s0=scene.at(0,'ghost',47);
 assert.equal(s0.stage,'pan');assert.equal(s0.playerVisible,false);
 const s1=scene.at(scene.PAN+scene.WALK/2,'living',47);
 assert.equal(s1.stage,'walk');assert(s1.womanY<41.5&&s1.womanY>28.5);
 assert(s1.cameraY<41.5&&s1.cameraY>28.3);
 assert.equal(s1.playerVisible,false);
 const source=file('outdoor.js');
 assert(source.includes("if(lilithPhase==='playing')return;"));
 assert(source.includes("if(lilithPhase!=='playing'){"));
 assert(source.includes("if(lilithPhase==='playing')updateLilith(now)"));
});

test('M40 prayer is a visible three-line dialogue before any transformation frames',()=>{
 assert.equal(scene.PRAYER.length,3);
 assert(scene.PRAYER.every(text=>text.length>30));
 const begin=scene.PAN+scene.WALK;
 const each=scene.PRAYER_TIME/3;
 for(let n=0;n<3;n++){
  const status=scene.at(begin+n*each+200,'ghost',47);
  assert.equal(status.stage,'prayer');
  assert.equal(status.prayerLine,n);
  assert.equal(status.prayer,scene.PRAYER[n]);
  assert.equal(status.treeFrame,-1);
  assert(status.womanVisible);
 }
 assert.equal(scene.at(begin+scene.PRAYER_TIME-1,'living',47).treeFrame,-1);
 const css=file('dk-lilith-cinematic-m40.css');
 assert(css.includes('#lilithPrayer'));
 assert(!css.includes('display:none!important}#lilithPrayer{display:none'));
});

test('M40 all six original panels render for either world form',()=>{
 const firstTransform=scene.PAN+scene.WALK+scene.PRAYER_TIME;
 const delta=scene.TRANSFORM/6;
 for(const form of ['ghost','living'])for(let n=0;n<6;n++){
  const state=scene.at(firstTransform+n*delta+100,form,47);
  assert.equal(state.treeFrame,n);
  assert.equal(state.row,form==='ghost'?0:1);
  assert(!state.womanVisible);
  assert(!state.playerVisible);
 }
 const dummy={naturalWidth:1774,naturalHeight:887};
 const gold=scene.sourceRect(dummy,0,5);
 const black=scene.sourceRect(dummy,1,5);
 assert.deepEqual(gold,{sx:1360,sy:58,sw:388,sh:272});
 assert.deepEqual(black,{sx:1360,sy:512,sw:388,sh:238});
 assert(black.sy+black.sh<755,'Annotations from approved reference must be cropped');
 assert.equal(scene.at(firstTransform+scene.TRANSFORM+400,'ghost',47).treeFrame,5);
});

test('M40 camera returns to the player, then restores controls and completes scene',()=>{
 const almost=scene.at(scene.TOTAL-50,'living',47);
 assert.equal(almost.stage,'return');assert.equal(almost.playerVisible,false);
 const end=scene.at(scene.TOTAL,'living',47);
 assert.equal(end.stage,'finished');assert.equal(end.done,true);
 assert.equal(end.playerVisible,true);assert.equal(end.cameraY,47.5);
 const source=file('outdoor.js');
 assert(source.includes("if(cinematicKey)localStorage.setItem(cinematicKey,'complete')"));
 assert(!source.includes("setTimeout(()=>{lilithPhase='finished'"));
 assert(source.includes("firstCourtyardSeen:!firstVisit"));
});
