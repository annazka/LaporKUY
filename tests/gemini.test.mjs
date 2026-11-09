import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeImage,validateAnalysis,validImage} from '../lib/gemini.mjs';
const result={relevant:true,category:'Jalan berlubang',severity:'berat',priority:'high',summary:'Terlihat kerusakan pada permukaan jalan.',reason:'Permukaan jalan tampak berlubang. Ukuran dan kedalaman belum dapat dipastikan.'};
test('analysis rejects unsupported files and images over limit',()=>{
 assert.equal(validImage(new Uint8Array([1,2,3]),'image/jpeg'),false);
 assert.equal(validImage(new Uint8Array(4194305),'image/png'),false);
 assert.throws(()=>validateAnalysis({...result,priority:'critical'}));
 assert.throws(()=>validateAnalysis({...result,relevant:false}));
 assert.equal(validateAnalysis(result).priority,'high');
});
test('image request uses server-side key header and validated JSON response',async()=>{
 const original=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
 process.env.GEMINI_API_KEY='fixture-not-a-real-key';process.env.GEMINI_MODEL='gemini-3.8-flash';
 globalThis.fetch=async(url,init)=>{
  assert.equal(url.includes('fixture-not-a-real-key'),false);
  assert.equal(init.headers['x-goog-api-key'],'fixture-not-a-real-key');
  const payload=JSON.parse(init.body);assert.equal(payload.contents[0].parts[0].inline_data.mime_type,'image/png');
  assert.equal(payload.generationConfig.responseMimeType,'application/json');
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]});
 };
 try{const actual=await analyzeImage(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png');assert.equal(actual.category,'Jalan berlubang');assert.equal(actual.model,'gemini-3.8-flash');}
 finally{globalThis.fetch=original;oldKey===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=oldKey;oldModel===undefined?delete process.env.GEMINI_MODEL:process.env.GEMINI_MODEL=oldModel;}
});
test('quota failures are actionable without exposing provider error body',async()=>{
 const original=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
 process.env.GEMINI_API_KEY='fixture-private';process.env.GEMINI_MODEL='gemini-3.8-flash';
 globalThis.fetch=async()=>Response.json({error:{message:'fixture-private sensitive provider message'}},{status:429});
 try{await assert.rejects(()=>analyzeImage(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),e=>e.status===429&&!e.message.includes('fixture-private')&&e.code==='HTTP_429');}
 finally{globalThis.fetch=original;oldKey===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=oldKey;oldModel===undefined?delete process.env.GEMINI_MODEL:process.env.GEMINI_MODEL=oldModel;}
});

async function withProvider(mock,run){
 const original=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
 process.env.GEMINI_API_KEY='fixture-private';process.env.GEMINI_MODEL='gemini-3.6-flash';globalThis.fetch=mock;
 try{await run();}finally{globalThis.fetch=original;oldKey===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=oldKey;oldModel===undefined?delete process.env.GEMINI_MODEL:process.env.GEMINI_MODEL=oldModel;}
}
const png=new Uint8Array([137,80,78,71,13,10,26,10]);
test('a transient 503 is retried once within the same shared deadline',async()=>{
 let calls=0,firstSignal;
 await withProvider(async(_url,init)=>{
  calls++;if(calls===1){firstSignal=init.signal;return Response.json({error:{message:'fixture-private',status:'UNAVAILABLE'}},{status:503});}
  assert.equal(firstSignal.aborted,false);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]});
 },async()=>{assert.equal((await analyzeImage(png,'image/png')).model,'gemini-3.6-flash');assert.equal(calls,2);});
});
test('persistent provider failures stop after two attempts rather than looping',async()=>{
 let calls=0;
 await withProvider(async()=>{calls++;return Response.json({error:{message:'fixture-private'}},{status:503});},async()=>{
  await assert.rejects(analyzeImage(png,'image/png'),error=>error.code==='HTTP_503'&&!error.message.includes('fixture-private'));assert.equal(calls,2);
 });
});
test('quota errors carry Retry-After and are never retried automatically',async()=>{
 let calls=0;
 await withProvider(async()=>{calls++;return Response.json({error:{details:[{retryDelay:'12s'}]}},{status:429});},async()=>{
  await assert.rejects(analyzeImage(png,'image/png'),error=>error.status===429&&error.retryAfter===12);assert.equal(calls,1);
 });
});
test('caller cancellation and an expired deadline do not invoke the provider',async()=>{
 let calls=0;
 await withProvider(async()=>{calls++;throw Error('should not run');},async()=>{
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(analyzeImage(png,'image/png',{signal:cancelled.signal}),error=>error.name==='AbortError');
  const timeout=new AbortController();timeout.abort(new DOMException('Timed out','TimeoutError'));
  await assert.rejects(analyzeImage(png,'image/png',{signal:timeout.signal}),error=>error.code==='TIMEOUT'&&error.status===504);assert.equal(calls,0);
 });
});
test('configuration errors, malformed responses, and truncated model output never become successful analyses',async()=>{
 for(const [response,code]of [
  [()=>Response.json({error:{details:[{reason:'API_KEY_INVALID'}]}},{status:400}),'API_KEY_INVALID'],
  [()=>new Response('<html>broken upstream</html>'),'INVALID_RESPONSE'],
  [()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[]}}]}),'INCOMPLETE_RESULT'],
 ])await withProvider(async()=>response(),async()=>{await assert.rejects(analyzeImage(png,'image/png'),error=>error.code===code);});
});

test('visual matching sends labeled photos and validates every candidate result',async()=>{
 const {compareReportPhotos}=await import('../lib/gemini.mjs');
 const candidates=[{id:'case-a',bytes:png,mimeType:'image/png'},{id:'case-b',bytes:png,mimeType:'image/png'}];
 await withProvider(async(_url,init)=>{
  const payload=JSON.parse(init.body);const parts=payload.contents[0].parts;
  assert.equal(parts.filter(p=>p.inline_data).length,3);assert.ok(parts.some(p=>p.text?.includes('case-a')));assert.ok(parts.some(p=>p.text?.includes('case-b')));
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({matches:candidates.map(c=>({report_id:c.id,same_damage:false,confidence:.1,reason:'Pola kerusakan berbeda.'}))})}]}}]});
 },async()=>assert.equal((await compareReportPhotos({bytes:png,mimeType:'image/png'},candidates)).matches.length,2));
 await withProvider(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({matches:[{report_id:'invented',same_damage:true,confidence:1,reason:'Invalid reference.'}]})}]}}]}),async()=>{
  await assert.rejects(compareReportPhotos({bytes:png,mimeType:'image/png'},candidates),error=>error.code==='INVALID_COMPARISON');
 });
});
