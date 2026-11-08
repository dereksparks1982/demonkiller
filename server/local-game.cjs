'use strict';

// Serve the single-player client from the loopback world process. Never serve
// server/data, Git metadata, hidden files or arbitrary repository files.
const fs = require('node:fs/promises');
const path = require('node:path');
const MIME = Object.freeze({
  '.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json',
  '.ogg':'audio/ogg','.mp3':'audio/mpeg','.mid':'audio/midi','.midi':'audio/midi'
});
const ROOT_FILES = new Set([
  'index.html','test-center.html','test-center.js','test-center.css',
  'cult-system.js','cult-network.js','cult-journal.css',
  'citizen-population.js','temple-music.js','dk-dungeon-art.js',
  'dk-skills.js','dk-menu-server.js','world-regions.js','outdoor.html','outdoor.js','outdoor.css',
  'outdoor-ui.js','temple-ui.js','temple-ui.css','sector-terrain-m32.js','streaming-cell-shells-m33.js','streaming-cell-contents-m34.js','dk-architect-interiors-m35.html','dk-architect-interiors-m35.js',
   'dk-architect-outdoors-m36.html','dk-architect-outdoors-m36.js'
]);

function localRequestAllowed(req, port) {
  const hosts = ['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port];
  if (!hosts.includes(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (origin && !hosts.some(host=>origin==='http://'+host)) return false;
  if (req.headers['sec-fetch-site']==='cross-site') return false;
  return true;
}
async function serveGame(req,res,pathname,rootDir=path.resolve(__dirname,'..')) {
  if (!['GET','HEAD'].includes(req.method)) return false;
  if (pathname==='/player') {
    res.writeHead(302, {Location:'/', 'Cache-Control':'no-store'});
    res.end();return true;
  }
  let decoded;
  try{ decoded=decodeURIComponent(pathname==='/'?'/index.html':pathname); }
  catch(_){return false;}
  if(!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0') ||
     decoded.split('/').some(part=>part==='..'||part.startsWith('.')))return false;
  const relative=decoded.slice(1),extension=path.extname(relative).toLowerCase();
  if(!Object.hasOwn(MIME,extension))return false;
  if(!ROOT_FILES.has(relative) &&
    !/^assets\/(?:[a-zA-Z0-9_ -]+\/)*[a-zA-Z0-9_ .-]+\.(?:html|js|css|png|jpg|jpeg|webp|svg|json|ogg|mp3|mid|midi)$/.test(relative))return false;
  const filename=path.join(rootDir,relative);
  try{
    const [realRoot,realFile]=await Promise.all([fs.realpath(rootDir),fs.realpath(filename)]);
    if(!realFile.startsWith(realRoot+path.sep))return false;
    const payload=await fs.readFile(realFile);
    res.writeHead(200,{
      'Content-Type':MIME[extension]+(['.html','.js','.css','.json'].includes(extension)?'; charset=utf-8':''),
      'Content-Length':payload.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
    });
    res.end(req.method==='HEAD'?undefined:payload);
    return true;
  }catch(error){
    if(error.code==='ENOENT'||error.code==='ENOTDIR')return false;
    throw error;
  }
}
module.exports={localRequestAllowed,serveGame};
