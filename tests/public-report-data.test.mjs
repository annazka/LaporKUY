import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPublicReports,filterPublicReports,categoryCounts,reportTrend,matchesTrend} from '../lib/public-report-data.mjs';
const asOf='2026-11-09T10:00:00Z';
const make=(id,created_at='2026-11-09T05:00:00Z',category='Jalan berlubang',status='submitted')=>({id,created_at,category,status,title:'jalan rusak',address:'tebet'});
test('seluruh halaman dimuat dan duplikat tidak dihitung dua kali',async()=>{
 const calls=[];const rows=Array.from({length:201},(_,i)=>make(String(i)));
 const loaded=await loadPublicReports(async path=>{calls.push(path);return path.includes('offset=0')?rows.slice(0,200):[rows[0],rows[200]];},asOf);
 assert.equal(loaded.length,201);assert.equal(calls.length,2);assert.match(calls[1],/offset=200/);assert.match(calls[0],/created_at=lte\./);
});
test('gagal pada halaman lanjutan tidak menghasilkan ringkasan parsial',async()=>{
 await assert.rejects(loadPublicReports(async path=>{if(path.includes('offset=0'))return Array.from({length:200},(_,i)=>make(String(i)));throw Error('timeout');},asOf),/timeout/);
});
test('filter periode memakai hari WIB dan memasukkan batas awal hari',()=>{
 const rows=[make('old','2026-10-10T16:59:59Z'),make('start','2026-10-10T17:00:00Z'),make('today','2026-11-09T05:00:00Z')];
 assert.deepEqual(filterPublicReports(rows,{period:'30'},asOf).map(r=>r.id),['start','today']);
});
test('kategori dan pencarian tidak mengubah data sumber dan menghitung kasus bukan dukungan',()=>{
 const rows=[{...make('a'),support_count:10},make('b'),make('c',undefined,'Drainase','completed')];
 assert.deepEqual(categoryCounts(rows),[{category:'Jalan berlubang',count:2},{category:'Drainase',count:1}]);
 assert.deepEqual(filterPublicReports(rows,{status:'completed',query:'DRAINASE'},asOf).map(r=>r.id),['c']);assert.equal(rows.length,3);
});
test('grafik bulanan dan pilihan grafik mengikuti batas bulan WIB',()=>{
 const rows=[make('a','2026-10-31T16:59:59Z'),make('b','2026-10-31T17:00:00Z')];
 assert.deepEqual(reportTrend(rows,'all',asOf),[{key:'2026-10',count:1},{key:'2026-11',count:1}]);
 assert.equal(matchesTrend(rows[1],'2026-11'),true);assert.equal(matchesTrend(rows[1],'2026-10'),false);
});
test('hari tanpa laporan ditampilkan sebagai nol, bukan laporan buatan',()=>{
 const trend=reportTrend([], '30',asOf);assert.equal(trend.length,30);assert.equal(trend.reduce((n,t)=>n+t.count,0),0);
 assert.deepEqual(categoryCounts([]),[]);
});
