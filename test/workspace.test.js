import {test} from 'node:test';import assert from 'node:assert/strict';
import {samples} from '../public/samples.js';
import {scoreChecks,learningProgress} from '../public/learning.js';
import {encodePhoto,makeBackup,restoreBackup,validateBackup} from '../public/notebook-tools.js';
import {validateInput,promptFor} from '../lib/activity.js';
import {allowRequest} from '../lib/limits.js';
const entry={id:'card',activity:samples[0],reflection:'Observed a shadow.',reflectionAnswers:{noticed:'A shadow.'},photoCount:1,date:'2026-10-07T20:00:00Z',checkResult:{answers:[0,1],correct:2,total:2}};
const jpeg=new Blob([Uint8Array.from([255,216,255,224,0,1,255,217])],{type:'image/jpeg'});
test('notebook backup round-trips photos, reflections and checked answers',async()=>{
 const backup=await makeBackup([entry],async()=>[jpeg]);const data=JSON.parse(await backup.text());
 const restored=validateBackup(data);assert.equal(restored[0].entry.reflection,entry.reflection);assert.equal(restored[0].photos[0].size,jpeg.size);assert.equal(restored[0].entry.checkResult.correct,2);
});
test('restore skips existing IDs and does not write their photos',async()=>{
 const data=JSON.parse(await(await makeBackup([entry],async()=>[jpeg])).text());let writes=0;
 const result=await restoreBackup(data,[entry],async()=>writes++,async()=>{},()=>true);
 assert.equal(result.added,0);assert.equal(writes,0);
});
test('failed import commit cleans up only imported photos',async()=>{
 const data=JSON.parse(await(await makeBackup([entry],async()=>[jpeg])).text());const cleaned=[];
 await assert.rejects(restoreBackup(data,[],async()=>{},async id=>cleaned.push(id),()=>false),/could not save/);assert.deepEqual(cleaned,['card']);
});
test('failed photo write prevents import commit and cleans earlier writes',async()=>{
 const data=JSON.parse(await(await makeBackup([entry,{...entry,id:'second'}],async()=>[jpeg])).text());const cleaned=[];let commit=false;
 await assert.rejects(restoreBackup(data,[],async id=>{if(id==='second')throw Error('quota');},async id=>cleaned.push(id),()=>{commit=true;return true;}),/quota/);
 assert.equal(commit,false);assert.deepEqual(cleaned,['card']);
});
test('corrupt backups and capacity overflow cannot erase existing cards',async()=>{
 assert.throws(()=>validateBackup({format:'outsideclass-notebook',version:1,entries:[{...entry,photos:[{mimeType:'image/jpeg',data:'aGVsbG8='}]}]}),/JPEG/);
 const data=JSON.parse(await(await makeBackup([entry],async()=>[jpeg])).text());const current=Array.from({length:100},(_,i)=>({...entry,id:String(i)}));let changed=false;
 await assert.rejects(restoreBackup(data,current,async()=>{changed=true;},async()=>{},()=>true),/exceed 100/);assert.equal(changed,false);
});
test('question image consent is required and image bytes stay out of the prompt',async()=>{
 const image=await encodePhoto(jpeg),input={topic:'Describe the shape.',minutes:10,level:'Beginner',place:'By a window',images:[image]};
 assert.throws(()=>validateInput(input),/Confirm sending/);
 const valid=validateInput({...input,imageConsent:true});assert.equal(valid.images.length,1);assert.ok(!promptFor(valid).includes(image.data));
 assert.throws(()=>validateInput({...input,imageConsent:true,images:[image,image,image]}));
});
test('understanding checks reject missing answers and progress counts practice accurately',()=>{
 assert.throws(()=>scoreChecks(samples[0].checks,[0,null]),/Answer both/);
 assert.equal(scoreChecks(samples[0].checks,[0,1]).correct,2);assert.equal(scoreChecks(samples[0].checks,[1,0]).correct,0);
 assert.deepEqual(learningProgress([entry]),{saved:1,reflections:1,returnVisits:0,checked:1,correct:2,questions:2});
});
test('production burst guard resets after a minute',()=>{
 const old=process.env.VERCEL;process.env.VERCEL='1';try{const req={headers:{'x-real-ip':'test-guard'}};for(let i=0;i<6;i++)assert.equal(allowRequest(req,1000),true);assert.equal(allowRequest(req,1000),false);assert.equal(allowRequest(req,61000),true);}finally{if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});
