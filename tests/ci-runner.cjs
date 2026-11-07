'use strict';
// DK Softworks: bounded CI runner. Individual test files run in isolated
// processes so a leaked handle cannot cancel the whole 40+ file regression.
// The tests are read directly from server/package.json, with no exclusions.
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const config=require('../server/package.json');
const argumentsMap=new Map(process.argv.slice(2).map(arg=>{
 const match=/^--([a-z-]+)=(\d+)$/.exec(arg);
 if(!match)throw Error('Invalid CI runner argument: '+arg);
 return [match[1],Number(match[2])];
}));
const shard=argumentsMap.get('shard')??0;
const shards=argumentsMap.get('shards')??1;
const timeoutMs=argumentsMap.get('timeout-ms')??60_000;
if(!Number.isSafeInteger(shard)||!Number.isSafeInteger(shards)||
 shards<1||shards>16||shard<0||shard>=shards||
 !Number.isSafeInteger(timeoutMs)||timeoutMs<5000||timeoutMs>180_000)
 throw Error('Invalid CI shard or per-file deadline');
const tokens=config.scripts.test.trim().split(/\s+/);
if(tokens[0]!=='node'||tokens[1]!=='--test')throw Error('Unexpected npm test definition');
const filenames=tokens.slice(2).map(value=>{
 if(!/^\.\.\/tests\/[a-z0-9-]+\.cjs$/.test(value))
  throw Error('Unsafe test path: '+value);
 const filename=path.resolve(root,'server',value);
 if(!filename.startsWith(path.join(root,'tests')+path.sep)||
  !fs.statSync(filename).isFile())throw Error('Missing test: '+value);
 return filename;
});
if(filenames.length<1||new Set(filenames).size!==filenames.length)
 throw Error('No tests or duplicate test paths in the server suite');
const assigned=filenames.filter((_,index)=>index%shards===shard);
const human=filename=>path.relative(root,filename).split(path.sep).join('/');
const formatDuration=ms=>(ms/1000).toFixed(1)+'s';
function runOne(filename){
 return new Promise(resolve=>{
  let output='',timedOut=false,settled=false;
  const started=Date.now();
  const child=spawn(process.execPath,['--test','--test-concurrency=1',filename],{
   cwd:root,
   env:{...process.env,CI:'true'},
   detached:process.platform!=='win32',
   stdio:['ignore','pipe','pipe']
  });
  const capture=buffer=>{
   output+=String(buffer);
   if(output.length>120_000)output=output.slice(-120_000);
  };
  child.stdout.on('data',capture);
  child.stderr.on('data',capture);
  const timer=setTimeout(()=>{
   timedOut=true;
   // Kill the process group, including the Node test worker subprocess.
   try{
    if(process.platform==='win32')child.kill('SIGKILL');
    else process.kill(-child.pid,'SIGKILL');
   }catch(_){child.kill('SIGKILL');}
  },timeoutMs);
  child.once('error',error=>{
   capture('\nUnable to launch test: '+error.message);
  });
  child.once('close',(code,signal)=>{
   if(settled)return;
   settled=true;clearTimeout(timer);
   resolve({filename,ok:!timedOut&&code===0,
    timedOut,code,signal,ms:Date.now()-started,output});
  });
 });
}
function escapeMarkdown(s){
 return s.replace(/\|/g,'\\|').replace(/[\r\n]/g,' ').slice(0,200);
}
(async()=>{
 const results=[];
 console.log('DK Server regression shard '+(shard+1)+'/'+shards+
  ': '+assigned.length+' test files, '+formatDuration(timeoutMs)+' per file');
 for(const filename of assigned){
  const result=await runOne(filename);results.push(result);
  const label=result.timedOut?'TIMEOUT':result.ok?'PASS':'FAIL';
  console.log('['+label+'] '+human(filename)+' ('+formatDuration(result.ms)+')');
  if(!result.ok){
   // On failure, preserve the tail: assertion messages and stack traces
   // usually appear there. The full TAP remains local to this job.
   console.error('----- '+human(filename)+' -----');
   console.error(result.output.slice(-16_000)||'(no diagnostic output)');
   console.error('----- End '+human(filename)+' -----');
  }
 }
 const failures=results.filter(x=>!x.ok);
 const summary=['## DK Server regression shard '+(shard+1)+'/'+shards,
  '', '**'+(results.length-failures.length)+' passed, '+failures.length+
  ' failed; '+filenames.length+' total files registered.**','',
  '| Test file | Result | Duration |','| --- | --- | ---: |'];
 for(const r of results)summary.push('| '+escapeMarkdown(human(r.filename))+
  ' | '+(r.timedOut?'⏱ Timeout':r.ok?'✅ Pass':'❌ Fail')+
  ' | '+formatDuration(r.ms)+' |');
 if(failures.length){
  summary.push('','### Failed or timed-out files');
  for(const r of failures)summary.push('- `'+human(r.filename)+'` ('+
   (r.timedOut?'exceeded '+formatDuration(timeoutMs):'exit '+r.code)+')');
 }
 if(process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary.join('\n')+'\n');
 if(process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
   'failed='+failures.map(r=>path.basename(r.filename)).join(',').slice(0,900)+'\n');
 console.log('SHARD RESULT: '+(results.length-failures.length)+' passed, '+
  failures.length+' failed. All '+assigned.length+' assigned files executed.');
 if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
