import {test} from 'node:test';import assert from 'node:assert/strict';import {validateInput,parseActivity} from '../lib/activity.js';import {samples} from '../public/samples.js';import handler from '../api/activity.js';
test('rejects invalid and unbounded inputs',()=>{for(const topic of ['',null,'a'.repeat(121)])assert.throws(()=>validateInput({topic,minutes:10,level:'Beginner',place:'Courtyard'}));assert.throws(()=>validateInput({topic:'Shadows',minutes:999,level:'Beginner',place:'Courtyard'}));});
test('accepts fenced model JSON and rejects invalid structure',()=>{assert.equal(parseActivity('```json\n'+JSON.stringify(samples[0])+'\n```').title,samples[0].title);assert.throws(()=>parseActivity('{"title":"Hello"}'));});
function response(){return{code:200,setHeader(){},status(n){this.code=n;return this;},json(x){this.data=x;return this;}};}
test('missing key returns honest unavailable state',async()=>{const old=process.env.GEMMA_API_KEY;delete process.env.GEMMA_API_KEY;try{const r=response();await handler({method:'POST',body:{topic:'Light',minutes:10,level:'Beginner',place:'Courtyard'}},r);assert.equal(r.code,503);}finally{if(old)process.env.GEMMA_API_KEY=old;}});
test('mocked successful provider response uses Gemma and strips unknown fields',async()=>{const old=process.env.GEMMA_API_KEY,fetchOld=global.fetch;process.env.GEMMA_API_KEY='test';global.fetch=async(url,init)=>{assert.match(url,/models\/gemma-/);assert.equal(init.headers['x-goog-api-key'],'test');return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({...samples[0],untrusted:'ignored'})}]}}]})};};try{const r=response();await handler({method:'POST',body:{topic:'Light',minutes:10,level:'Beginner',place:'Courtyard'}},r);assert.equal(r.code,200);assert.equal(r.data.activity.untrusted,undefined);}finally{global.fetch=fetchOld;if(old)process.env.GEMMA_API_KEY=old;else delete process.env.GEMMA_API_KEY;}});
test('accepts prose-wrapped JSON with braces inside strings, rejects truncation and multiple objects',()=>{
 const a={...samples[0],title:'Look at {patterns} and "shapes"'};
 assert.equal(parseActivity('Here is your card:\n```json\n'+JSON.stringify(a)+'\n```').title,a.title);
 assert.throws(()=>parseActivity(JSON.stringify(a).slice(0,-5)));
 assert.throws(()=>parseActivity(JSON.stringify(a)+'\n'+JSON.stringify(a)));
});
test('distinguishes provider failures and excludes thinking from activity JSON',async()=>{
 const oldKey=process.env.GEMMA_API_KEY,oldModel=process.env.GEMMA_MODEL,oldFetch=global.fetch;
 process.env.GEMMA_API_KEY='test-private-key';process.env.GEMMA_MODEL='gemma-4-26b-a4b-it';
 const invoke=async(fn)=>{global.fetch=fn;const r=response();await handler({method:'POST',body:{topic:'Light',minutes:10,level:'Beginner',place:'Courtyard'}},r);assert.ok(!JSON.stringify(r.data).includes('test-private-key'));return r;};
 const ok=result=>async()=>({ok:true,json:async()=>result});
 try {
  for(const [status,code] of [[400,'AI_REQUEST_REJECTED'],[401,'AI_AUTH'],[403,'AI_ACCESS'],[404,'AI_MODEL_NOT_FOUND'],[429,'AI_QUOTA'],[503,'AI_PROVIDER_UNAVAILABLE']])assert.equal((await invoke(async()=>({ok:false,status}))).data.code,code);
  assert.equal((await invoke(async()=>{throw new DOMException('timeout','TimeoutError');})).data.code,'AI_TIMEOUT');
  assert.equal((await invoke(async()=>{throw new TypeError('fetch failed');})).data.code,'AI_NETWORK');
  assert.equal((await invoke(ok({}))).data.code,'AI_EMPTY');
  assert.equal((await invoke(ok({promptFeedback:{blockReason:'SAFETY'}}))).data.code,'AI_BLOCKED');
  assert.equal((await invoke(ok({candidates:[{finishReason:'MAX_TOKENS'}]}))).data.code,'AI_TRUNCATED');
  assert.equal((await invoke(ok({candidates:[{content:{parts:[{text:'{"title":"wrong"}'}]}}]}))).data.code,'AI_ACTIVITY_FORMAT');
  assert.equal((await invoke(async()=>({ok:true,json:async()=>{throw new SyntaxError('bad');}}))).data.code,'AI_PROVIDER_FORMAT');
  const r=await invoke(async(url,init)=>{const config=JSON.parse(init.body).generationConfig;assert.equal(config.thinkingConfig.thinkingLevel,'minimal');return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'},{text:JSON.stringify(samples[0])}]}}]})};});
  assert.equal(r.code,200);assert.equal(r.data.activity.title,samples[0].title);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMMA_API_KEY;else process.env.GEMMA_API_KEY=oldKey;if(oldModel===undefined)delete process.env.GEMMA_MODEL;else process.env.GEMMA_MODEL=oldModel;}
});

// ---- Group mode ----
import {promptFor} from '../lib/activity.js';
const solo={topic:'Light',minutes:10,level:'Beginner',place:'Courtyard'};
const groupCard={...samples[0],groupTips:'Work in pairs. Agree a boundary first.',discussion:['What did you notice first?','What surprised you?']};
test('defaults to a solo learner and keeps the prompt free of group text',()=>{
 const input=validateInput(solo);assert.equal(input.audience,'Myself');assert.equal(input.groupSize,undefined);
 assert.ok(!promptFor(input).includes('discussion'));
});
test('validates group size, age range and audience',()=>{
 const ok=validateInput({...solo,audience:'Class',groupSize:25,ageRange:'8-10'});assert.equal(ok.groupSize,25);
 for(const bad of [{audience:'Class',groupSize:1,ageRange:'8-10'},{audience:'Class',groupSize:41,ageRange:'8-10'},{audience:'Class',groupSize:2.5,ageRange:'8-10'},{audience:'Class',groupSize:10,ageRange:'3'},{audience:'Class',ageRange:'8-10'},{audience:'Boss',groupSize:5,ageRange:'8-10'}])
  assert.throws(()=>validateInput({...solo,...bad}),bad.audience);
});
test('group prompt asks for leader guidance and discussion questions',()=>{
 const p=promptFor(validateInput({...solo,audience:'Class',groupSize:25,ageRange:'8-10'}));
 assert.match(p,/discussion/);assert.match(p,/groupTips/);assert.match(p,/25 learners aged 8-10/);
});
test('group cards must include guidance; extra fields are stripped for solo cards',()=>{
 assert.throws(()=>parseActivity(JSON.stringify(samples[0]),'Class'));
 assert.throws(()=>parseActivity(JSON.stringify({...groupCard,discussion:['only one']}),'Class'));
 assert.deepEqual(parseActivity(JSON.stringify(groupCard),'Class').discussion,groupCard.discussion);
 assert.equal(parseActivity(JSON.stringify(groupCard)).discussion,undefined);
});
test('mocked provider returns a group card end to end',async()=>{
 const oldKey=process.env.GEMMA_API_KEY,oldFetch=global.fetch;process.env.GEMMA_API_KEY='test';
 global.fetch=async(url,init)=>{assert.match(JSON.parse(init.body).contents[0].parts[0].text,/groupTips/);return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(groupCard)}]}}]})};};
 try{const r=response();await handler({method:'POST',body:{...solo,audience:'Family',groupSize:3,ageRange:'5-7'}},r);assert.equal(r.code,200);assert.equal(r.data.activity.groupSize,3);assert.equal(r.data.activity.discussion.length,2);}
 finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMMA_API_KEY;else process.env.GEMMA_API_KEY=oldKey;}
});


import {safetyNotes} from '../public/safety.js';
test('window and seated requests remain in place and include deterministic precautions',()=>{
 const input=validateInput({...solo,place:'By a window',mobility:'Seated',audience:'Class',groupSize:20,ageRange:'8-10'});
 assert.match(promptFor(input),/indoors at a closed window/);
 assert.match(promptFor(input),/without standing, walking/);
 const notes=safetyNotes(input).join(' ');
 assert.match(notes,/An adult leads/);
 assert.match(notes,/Keep the window closed/);
 assert.match(notes,/Stay seated/);
 assert.throws(()=>validateInput({...solo,mobility:'Flying'}));
});
test('provider includes app-owned precautions for a window activity',async()=>{
 const oldKey=process.env.GEMMA_API_KEY,oldFetch=global.fetch;process.env.GEMMA_API_KEY='test';
 global.fetch=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(groupCard)}]}}]})});
 try{const r=response();await handler({method:'POST',body:{...solo,place:'By a window',mobility:'Seated',audience:'Family',groupSize:3,ageRange:'5-7'}},r);assert.equal(r.code,200);assert.ok(r.data.activity.beforeYouGo.some(note=>note.includes('window closed')));assert.ok(r.data.activity.beforeYouGo.some(note=>note.includes('Stay seated')));}
 finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMMA_API_KEY;else process.env.GEMMA_API_KEY=oldKey;}
});
