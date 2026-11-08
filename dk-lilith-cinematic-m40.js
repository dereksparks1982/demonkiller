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
// Source crops: column boundaries are the six approved panels; the top and
// bottom row annotations are deliberately excluded. The lower row's caption
// starts at y≈755, so stop at y745 to retain the tree roots, not the text.
function sourceRect(img,row,frameIndex){
 const width=img?.naturalWidth||1774;
 const height=img?.naturalHeight||887;
 const scaleX=width/1774,scaleY=height/887;
 const n=clamp(Math.floor(frameIndex),0,5),x0=Math.round(n*1774/6),
  x1=Math.round((n+1)*1774/6),y0=row===0?60:505,y1=row===0?340:745;
 return {sx:Math.round(x0*scaleX),sy:Math.round(y0*scaleY),
  sw:Math.round((x1-x0)*scaleX),sh:Math.round((y1-y0)*scaleY)};
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
 const n=clamp(frameIndex,0,5);
 const widths=[54,69,83,102,126,166],
  heights=[62,77,96,117,139,161];
 return drawPanel(ctx,img,row,n,centerX,bottomY,widths[n],heights[n]);
}
return Object.freeze({SHEET,PRAYER,PAN,WALK,PRAYER_TIME,TRANSFORM,HOLD,RETURN,
 TOTAL,at,sourceRect,drawLilith,drawTree});
});
