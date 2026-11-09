/* DK Softworks · M40 · Lilith's approved courtyard transformation.
 * The twelve images are cropped at render-time from the owner's ORIGINAL
 * two-row reference sheet, removing captions, not creating replacement art.
 * Six stages per branch. No new graphics or smoothing.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DKLilithCinematic=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const SHEET='characters/crystal-woman/transformations/approved-willow-transformations-reference.png';
const PRAYER=Object.freeze([
 'Earth beneath my feet, receive the name I surrender.',
 'Take my breath for wind, my arms for shelter, my bones for roots.',
 'Where sorrow has taken hold, let me remain. Let me be still.'
]);
const PAN=1700,WALK=5200,PRAYER_TIME=8400,TRANSFORM=5400,HOLD=1600,RETURN=3300;
const T1=PAN,T2=T1+WALK,T3=T2+PRAYER_TIME,T4=T3+TRANSFORM,
 T5=T4+HOLD,TOTAL=T5+RETURN;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=u=>{const x=clamp(u,0,1);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*smooth(t);
function at(elapsed,form='ghost',playerY=47){
 const t=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
 const row=form==='living'?1:0;
 const atStart=Number.isFinite(playerY)?playerY+0.5:47.5;
 const scene={row,t,stage:'pan',cameraX:32.5,cameraY:atStart,
   womanX:32.5,womanY:41.5,womanVisible:true,
   treeFrame:-1,prayerLine:-1,prayer:null,playerVisible:false,done:false};
 if(t<T1){
  scene.stage='pan';
  scene.cameraY=mix(atStart,41.5,t/T1);
 }else if(t<T2){
  scene.stage='walk';
  const p=(t-T1)/WALK;
  scene.womanY=mix(41.5,28.5,p);
  scene.cameraY=mix(41.5,28.3,p);
 }else if(t<T3){
  scene.stage='prayer';scene.womanY=28.5;scene.cameraY=28.5;
  scene.prayerLine=Math.min(PRAYER.length-1,
   Math.floor((t-T2)/(PRAYER_TIME/PRAYER.length)));
  scene.prayer=PRAYER[scene.prayerLine];
 }else if(t<T4){
  scene.stage='transform';scene.womanVisible=false;scene.cameraY=28.5;
  scene.treeFrame=Math.min(5,Math.floor((t-T3)/(TRANSFORM/6)));
 }else if(t<T5){
  scene.stage='hold';scene.womanVisible=false;scene.cameraY=28.5;scene.treeFrame=5;
 }else if(t<TOTAL){
  scene.stage='return';scene.womanVisible=false;scene.treeFrame=5;
  scene.cameraY=mix(28.5,atStart,(t-T5)/RETURN);
 }else{
  scene.stage='finished';scene.womanVisible=false;scene.treeFrame=5;
  scene.cameraY=atStart;scene.playerVisible=true;scene.done=true;
 }
 return scene;
}
// The owner-approved 1774x887 sheet is not a uniform grid. Its poses occupy
// uneven columns; dividing width by six painted fragments of adjacent poses.
// These twelve measured rectangles exclude their neighbors and captions.
// Original artwork is retained. SHA: f1f3bf29226f3b344f0b6fff5bdf260256ab6f7d.
const FRAME_RECTS=Object.freeze([
 Object.freeze([
  [64,84,213,328],[291,80,475,330],[516,74,735,330],
  [778,65,1031,330],[1046,67,1332,330],[1360,58,1748,330]
 ]),
 Object.freeze([
  [64,520,211,748],[294,514,467,748],[521,515,732,748],
  [773,512,1030,748],[1058,522,1328,748],[1360,512,1748,750]
 ])
]);
function sourceRect(img,row,frameIndex){
 const width=img?.naturalWidth||1774,height=img?.naturalHeight||887;
 const n=clamp(Math.floor(frameIndex),0,5);
 const [x0,y0,x1,y1]=FRAME_RECTS[row===1?1:0][n];
 const sx=Math.round(x0*width/1774),sy=Math.round(y0*height/887);
 const ex=Math.round(x1*width/1774),ey=Math.round(y1*height/887);
 return {sx,sy,sw:ex-sx,sh:ey-sy};
}
function drawPanel(ctx,img,row,n,centerX,bottomY,width,height){
 if(!img||!img.complete||!img.naturalWidth)return false;
 const r=sourceRect(img,row,n);
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(img,r.sx,r.sy,r.sw,r.sh,
  Math.round(centerX-width/2),Math.round(bottomY-height),width,height);
 ctx.restore();return true;
}
function drawLilith(ctx,img,state){
 if(!state?.womanVisible)return false;
 // Pre-transformation figure is small enough to match a 32px character.
 const bottom=state.womanY*32+12;
 return drawPanel(ctx,img,state.row,0,state.womanX*32,bottom,47,55);
}
function drawTree(ctx,img,row,frameIndex,centerX,bottomY){
 const n=clamp(Math.floor(frameIndex),0,5);
 // Each stage is its actual source pose, never a scaled copy of final tree.
 // The same ground anchor and approved in-game size are retained throughout.
 const widths=[47,69,83,102,126,166],
  heights=[55,77,96,117,139,161];
 return drawPanel(ctx,img,row,n,centerX,bottomY,widths[n],heights[n]);
}
return Object.freeze({SHEET,PRAYER,PAN,WALK,PRAYER_TIME,TRANSFORM,HOLD,RETURN,
 TOTAL,at,sourceRect,drawLilith,drawTree});
});
