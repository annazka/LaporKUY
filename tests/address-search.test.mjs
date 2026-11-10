import test from 'node:test';
import assert from 'node:assert/strict';
import {addressQuery,addressResults,createAddressSearch} from '../lib/address-search.mjs';
const feature=(name='Monas',coordinates=[106.8272,-6.1754])=>({geometry:{type:'Point',coordinates},properties:{name,city:'Jakarta',country:'Indonesia'}});
test('kata pencarian divalidasi dan spasi dinormalisasi',()=>{assert.equal(addressQuery('  Monas   Jakarta  '),'Monas Jakarta');for(const q of ['',null,'UI','a'.repeat(301),'Monas\nJakarta'])assert.equal(addressQuery(q),null);});
test('hasil hanya berisi titik valid, nama aman, unik dan maksimal lima',()=>{
 const rows=addressResults({features:[feature(),feature(),feature('Bandung',[107.6,-6.9]),feature('invalid',['106.8',-6.2]),{geometry:{type:'Polygon'},properties:{}},...Array.from({length:9},(_,i)=>feature('Alamat '+i,[106.8,-6.2+i*.001]))]});assert.equal(rows.length,5);assert.equal(rows[0].label,'Monas, Jakarta, Indonesia');assert.equal(rows[0].latitude,-6.1754);assert.throws(()=>addressResults({}),/INVALID/);
});
test('provider tetap, bbox Jakarta, cache, dan pembatasan permintaan bekerja',async()=>{
 let at=1000,calls=0;const search=createAddressSearch({now:()=>at,fetcher:async(url,init)=>{calls++;assert.equal(url.origin,'https://photon.komoot.io');assert.equal(url.searchParams.get('bbox'),'106.65,-6.5,107,-6.05');assert.ok(init.signal);return {ok:true,status:200,json:async()=>({features:[feature()]})};}});
 assert.equal((await search('Monas')).length,1);await search('monas');assert.equal(calls,1);await assert.rejects(search('Tebet'),e=>e.status===429);at+=1000;await search('Tebet');assert.equal(calls,2);at+=600001;await search('Monas');assert.equal(calls,3);
});
test('provider gagal atau data rusak tidak dijadikan hasil sukses palsu',async()=>{
 const search=createAddressSearch({fetcher:async()=>({ok:false,status:503})});await assert.rejects(search('Monas'),/UNAVAILABLE/);
 const limited=createAddressSearch({fetcher:async()=>({ok:false,status:429})});await assert.rejects(limited('Monas'),e=>e.status===429);
 const invalid=createAddressSearch({fetcher:async()=>({ok:true,status:200,json:async()=>({})})});await assert.rejects(invalid('Monas'),/INVALID/);
});

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function route({signedIn=true,error=null}={}){
 let calls=0;const exports={};
 const modules={'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200,headers:init?.headers})}},'@/lib/backend':{viewer:async()=>signedIn?{id:'user'}:null},'@/lib/address-search.mjs':{addressQuery,createAddressSearch:()=>async()=>{calls++;if(error)throw error;return addressResults({features:[feature()]});}}};
 const code=ts.transpileModule(readFileSync(new URL('../app/api/geocode/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext('(function(require,exports){'+code+'})',{URL})(n=>modules[n],exports);
 return {GET:exports.GET,calls:()=>calls};
}
test('API memerlukan login dan input valid sebelum menghubungi provider',async()=>{
 const anon=route({signedIn:false});assert.equal((await anon.GET({url:'https://example.test/api/geocode?q=Monas'})).status,401);assert.equal(anon.calls(),0);
 const valid=route();assert.equal((await valid.GET({url:'https://example.test/api/geocode?q=x'})).status,400);assert.equal(valid.calls(),0);
 const response=await valid.GET({url:'https://example.test/api/geocode?q=Monas'});assert.equal(response.status,200);assert.match(response.headers['Cache-Control'],/no-store/);assert.equal(response.body.results.length,1);
});
test('API menampilkan error aman dan retry-after saat provider dibatasi',async()=>{
 const limited=route({error:{status:429}});const response=await limited.GET({url:'https://example.test/api/geocode?q=Monas'});assert.equal(response.status,429);assert.equal(response.headers['Retry-After'],'1');
 const failed=route({error:Error('internal provider detail')});const error=await failed.GET({url:'https://example.test/api/geocode?q=Monas'});assert.equal(error.status,502);assert.doesNotMatch(error.body.error,/internal provider/);
});

import {coordinateInput,addressVariants} from '../lib/location-query.mjs';
const detailed="Gg. H. Saaman Blok Sa'aman No.30, RT.2/RW.8, Ragunan, Ps. Minggu, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12550, Indonesia";
test('koordinat desimal menerima koma, spasi, titik koma dan urutan terbalik',()=>{
 for(const input of ['-6.29, 106.83','(-6.29,106.83)','-6.29 106.83','-6.29;106.83','106.83, -6.29','Koordinat -6.290000, 106.830000'])assert.deepEqual(coordinateInput(input),{latitude:-6.29,longitude:106.83});
 assert.equal(coordinateInput(detailed),null);assert.throws(()=>coordinateInput('-6.9,107.6'),e=>e.status===400);
});
test('koordinat tidak memanggil provider dan tidak mencari lokasi di luar cakupan',async()=>{
 let calls=0;const search=createAddressSearch({fetcher:async()=>{calls++;throw Error('unexpected');}});
 const results=await search('-6.29, 106.83');assert.equal(results[0].latitude,-6.29);assert.equal(results[0].approximate,false);
 await assert.rejects(search('-6.9, 107.6'),e=>e.status===400);assert.equal(calls,0);
});
test('alamat lengkap hingga 300 karakter diterima dan disederhanakan bertahap',()=>{
 assert.equal(addressQuery(detailed),detailed);const variants=addressVariants(detailed);
 assert.equal(variants[0],detailed);assert.match(variants[1],/Gang H Saaman No30/);assert.doesNotMatch(variants[1],/RT\.|Blok/);assert.match(variants[2],/Gang H Saaman, Ragunan/);assert.equal(variants[3],'Ragunan, Pasar Minggu, Jakarta Selatan');
});
test('hasil pencarian yang disederhanakan ditandai sebagai perkiraan dan alamat asli dipertahankan',async()=>{
 let time=1000;const calls=[];const search=createAddressSearch({now:()=>time,pause:async ms=>{time+=ms;},fetcher:async url=>{calls.push(url.searchParams.get('q'));return {ok:true,status:200,json:async()=>({features:calls.length===3?[feature('Gang H Saaman')]:[]})};}});
 const rows=await search(detailed);assert.equal(calls.length,3);assert.equal(rows[0].approximate,true);assert.equal(rows[0].preserveInput,true);assert.equal(time,3000);
});
test('fallback dibatasi dan hasil kosong tidak mengarang titik koordinat',async()=>{
 let time=1000,calls=0;const search=createAddressSearch({now:()=>time,pause:async ms=>{time+=ms;},fetcher:async()=>{calls++;return {ok:true,status:200,json:async()=>({features:[]})};}});
 assert.deepEqual(await search(detailed),[]);assert.equal(calls,4);
});
