import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {distanceMeters,nearbyCandidates,validatePhotoMatches,choosePhotoMatch} from '../lib/report-matching.mjs';
import {createPhotoComparison,prepareComparisonPhoto} from '../lib/photo-comparison.mjs';
const point={latitude:-6.2,longitude:106.84};
const at=(meters)=>({...point,latitude:point.latitude+meters/6371000*180/Math.PI});
const report=(id,meters,extra={})=>({id,category:'Jembatan',status:'submitted',created_at:'2026-10-30T01:00:00Z',...at(meters),...extra});
const answer=(id,confidence=.95,same_damage=true)=>({report_id:id,same_damage,confidence,reason:'Bentuk patahan dan penanda struktur pada kedua foto konsisten.'});
test('only same-category open cases within the spherical 25-metre radius are candidates',()=>{
 assert.ok(Math.abs(distanceMeters(point,at(24.99))-24.99)<.00001);
 const cases=[report('near',2),report('edge',24.99),report('far',25.01),report('other',1,{category:'Trotoar'}),...['completed','rejected','awaiting_confirmation'].map(status=>report(status,1,{status}))];
 assert.deepEqual(nearbyCandidates(cases,'Jembatan',point).map(c=>c.id),['near','edge']);
 assert.equal(distanceMeters(point,{latitude:NaN,longitude:point.longitude}),Infinity);
});
test('closer cases score higher but distance can never rescue a weak or negative visual match',()=>{
 const candidates=nearbyCandidates([report('near',2),report('far',20)],'Jembatan',point);
 assert.equal(choosePhotoMatch([answer('near'),answer('far')],candidates).report_id,'near');
 assert.equal(choosePhotoMatch([answer('near',.89),answer('far',.99,false)],candidates),null);
 assert.equal(choosePhotoMatch([answer('far',.95)],[{...candidates[1],distance:25.01}]),null);
 assert.equal(choosePhotoMatch([answer('far',.95)],[{...candidates[1],distance:25}]).report_id,'far');
});
test('provider must score each known candidate exactly once with a valid probability',()=>{
 const candidates=[{id:'a'},{id:'b'}];
 assert.equal(validatePhotoMatches({matches:[answer('a'),answer('b')]},candidates).length,2);
 for(const matches of [[answer('a')],[answer('a'),answer('a')],[answer('a'),answer('unknown')],[answer('a'),answer('b',1.1)],[answer('a'),answer('b',NaN)]])assert.throws(()=>validatePhotoMatches({matches},candidates));
});
test('comparison copies are resized without changing the original photo evidence',async()=>{
 const bytes=await sharp({create:{width:3000,height:2000,channels:3,background:'#555'}}).png().toBuffer();const original=Buffer.from(bytes);
 const result=await prepareComparisonPhoto({bytes,mimeType:'image/png'});const metadata=await sharp(result.bytes).metadata();
 assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,1280);assert.ok(metadata.height<=1280);assert.deepEqual(bytes,original);
});
const photo={bytes:new Uint8Array([1,2,3]),mimeType:'image/png'};
const reference={id:'a',bytes:new Uint8Array([4,5,6]),mimeType:'image/png'};
test('same photo pairs reuse comparisons per user; failed calls remain retryable',async()=>{
 let calls=0,fail=true;
 const service=createPhotoComparison({prepare:async p=>p,compare:async()=>{calls++;if(fail)throw Error('provider down');return {matches:[answer('a')]};}});
 await assert.rejects(service.run('u',photo,[reference]));fail=false;
 await service.run('u',photo,[reference]);await service.run('u',photo,[{...reference,distance:5}]);assert.equal(calls,2);
 await service.run('other-user',photo,[reference]);assert.equal(calls,3);
});
test('concurrent requests share a comparison and one cancelled waiter does not cancel another',async()=>{
 let calls=0,release,providerSignal;
 const service=createPhotoComparison({prepare:async p=>p,compare:async(_p,_c,{signal})=>{calls++;providerSignal=signal;return new Promise(resolve=>release=resolve);}});
 const a=new AbortController(),b=new AbortController();
 const first=service.run('u',photo,[reference],{signal:a.signal}),second=service.run('u',photo,[reference],{signal:b.signal});
 const cancelled=assert.rejects(first,e=>e.name==='AbortError');await new Promise(resolve=>setImmediate(resolve));a.abort();await cancelled;
 assert.equal(providerSignal.aborted,false);release({matches:[answer('a')]});await second;assert.equal(calls,1);
});
test('provider stops when every waiter cancels; no candidates requires no AI call',async()=>{
 let providerSignal,calls=0;
 const service=createPhotoComparison({prepare:async p=>p,compare:async(_p,_c,{signal})=>{calls++;providerSignal=signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError'))));}});
 assert.deepEqual(await service.run('u',photo,[]),[]);assert.equal(calls,0);
 const controller=new AbortController(),job=service.run('u',photo,[reference],{signal:controller.signal});const rejected=assert.rejects(job,e=>e.name==='AbortError');await new Promise(resolve=>setImmediate(resolve));controller.abort();await rejected;assert.equal(providerSignal.aborted,true);
});
