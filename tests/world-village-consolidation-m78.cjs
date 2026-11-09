'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const WORLD=require('../server/world.cjs');
const ACTORS=require('../server/world-actors-m73.cjs');
const ANCHOR=require('../server/world-anchor-m78.cjs');
const R=require('../world-regions.js');
const NOW=Date.UTC(2026,10,9);
test('one genuine 9216-world village and only full-sized prebuilt temple',()=>{
 const world=WORLD.makeWorld(NOW);
 assert.equal(ANCHOR.TEMPLE.w,16);assert.equal(ANCHOR.TEMPLE.h,16);
 assert.equal(Object.keys(world.world_grid.buildings).length,0);
 assert.equal(world.areas[R.VILLAGE].objects.length,0);
 assert.deepEqual(ANCHOR.SPAWN,{x:4128,y:4143,facing:'north'});
 assert.equal(ACTORS.RADIUS,18);
 const atlas=require('../server/world-atlas-m70.cjs');
 assert.throws(()=>atlas.editCells(world,{action:'fill_cells',
   expected_revision:world.revision,x:32,y:32,width:1,height:1,material:'sea'}),/protected/);
 const ground=editor.readTile(world,ANCHOR.SPAWN.x,ANCHOR.SPAWN.y);
 assert.equal(ground.material,'path');
 const changed=editor.edit(world,{action:'paint_material',
   expected_revision:world.revision,x:ANCHOR.SPAWN.x,y:ANCHOR.SPAWN.y,
   width:1,height:1,material:'grass'}).world;
 assert.equal(editor.readTile(changed,ANCHOR.SPAWN.x,ANCHOR.SPAWN.y).material,'grass');
 const editor=require('../server/world-terrain-editor-m69.cjs');
 assert.throws(()=>editor.edit(world,{action:'paint_material',expected_revision:world.revision,
 x:ANCHOR.TEMPLE.x,y:ANCHOR.TEMPLE.y,width:1,height:1,material:'grass'}),/obstruct/);
});
test('temple exterior exit takes original story character into the global atlas',()=>{
 let world=WORLD.createCharacter(WORLD.makeWorld(NOW),1,'TRAVELER',NOW).world;
 world=WORLD.applyCharacterAction(world,1,{action:'finish_opening'}).world;
 world.characters['1'].x=8;world.characters['1'].y=1;
 world=WORLD.applyCharacterAction(world,1,{action:'move',direction:'north'}).world;
 assert.deepEqual(world.characters['1'].atlas_position,{...ANCHOR.SPAWN,steps:0});
 const view=ACTORS.view(world);
 assert.equal(view.started,true);
 assert(view.landmarks.some(o=>o.type==='temple'));
 const close=ACTORS.perform(world,{action:'enter',x:ANCHOR.TREE.x+1,y:ANCHOR.TREE.y+8}).world;
 const witnessed=ACTORS.perform(close,{action:'witness'}).world;
 assert.equal(witnessed.characters['1'].lilith_witnessed,true);
});
test('browser renders full temple roof and both willow truths',()=>{
 const root=path.join(__dirname,'..');
 const js=fs.readFileSync(path.join(root,'dk-world-explore-m73.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'dk-world-explore-m73.html'),'utf8');
 assert.match(js,/for\(let by=0;by<t\.h;by\+\+\)for\(let bx=0;bx<t\.w;bx\+\+\)/);
 assert.match(js,/Death does not reveal another world/);
 assert.match(js,/The living fear what they cannot understand/);
 assert.match(html,/width="1184" height="1184"/);
});
