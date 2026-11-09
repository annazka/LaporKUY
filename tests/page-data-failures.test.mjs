import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as reportPhotos from '../lib/report-photo.mjs';

const report={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',title:'jalan rusak',status:'scheduled',progress:0,category:'Jalan berlubang',created_at:'2026-11-01',support_count:0};
async function renderPage(file,failures=[],empty=false,options={}){
 const currentReport={...report,status:options.status ?? report.status};
 const requests=[];
 const backend=async path=>{requests.push(path);if(failures.some(part=>path.includes(part)))throw Error('timeout');if(path.includes('/point_ledger?'))return [{amount:25}];if(path.includes('/submissions?'))return empty?[]:[{report_id:report.id,is_primary:true}];if(path.includes('report_updates'))return options.updates ?? [];return empty?[]:[currentReport];};
 const pass=({children})=>React.createElement('div',null,children);
 const modules={
  'react/jsx-runtime':await import('react/jsx-runtime'),
  'react':React,
  'next/link':{__esModule:true,default:pass},
  'next/navigation':{notFound(){throw Error('not-found');}},
  'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/lib/backend':{backend,viewer:async()=>options.anonymous ? null : ({id:'user',name:'warga'}),requireViewer:async()=>({id:'user',name:'warga'}),accessToken:async()=>undefined,photoUrl:path=>'/api/photo?path='+encodeURIComponent(path)},
  '@/lib/types':{formatDate:()=>'',statusLabels:{}},
  '@/lib/rules.mjs':{isOverdue:()=>false},
  '@/lib/report-photo.mjs':reportPhotos,
  '@/components/data-unavailable':{DataUnavailable:({message})=>React.createElement('div',{role:'alert'},message)},
  '@/components/ui':{PageTitle:()=>null,Stats:({items})=>React.createElement('div',null,items.map(i=>`${i.label}:${i.value}`).join('|')),Empty:({title})=>React.createElement('div',null,title),Status:()=>null,DailyFlag:()=>null,DetailFacts:()=>null},
  '@/components/widgets':{ReportExplorer:({reports})=>React.createElement('div',null,`reports:${reports.length}`)},
  '@/components/dashboard-nav':{DashboardNav:()=>null},
  '@/components/forms':{OperatorForm:()=>null,ConfirmRepair:()=>React.createElement('div',null,'confirm-action')},
  '@/components/auth-modal':{AuthLink:pass},
  '@/components/report-image':{ReportImage:()=>null},
 };
 const imageSource=ts.transpileModule(readFileSync(new URL('../components/report-image.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const imageExports={};vm.runInNewContext('(function(require,exports){'+imageSource+'})')(name=>modules[name],imageExports);
 modules['@/components/report-image']=imageExports;
 const source=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext('(function(require,exports){'+source+'})')(name=>{if(!(name in modules))throw Error('missing mock '+name);return modules[name];},exports);
 const element=await exports.default({params:Promise.resolve({id:report.id}),searchParams:Promise.resolve({})});
 return {html:renderToStaticMarkup(element),requests};
}
test('saldo gagal tidak menghilangkan laporan atau menampilkan nol',async()=>{const {html}=await renderPage('app/dashboard/page.tsx',['point_ledger']);assert.match(html,/Poin kamu:—/);assert.match(html,/reports:1/);});
test('kontribusi gagal tidak dianggap laporan kosong dan tidak memuat data turunannya',async()=>{const {html,requests}=await renderPage('app/dashboard/page.tsx',['submissions']);assert.match(html,/Laporan aktif:—/);assert.match(html,/Poin kamu:25/);assert.doesNotMatch(html,/Mulai kontribusi/);assert.equal(requests.some(p=>p.includes('report_updates')),false);});
test('riwayat gagal tetap menampilkan laporan dan saldo',async()=>{const {html}=await renderPage('app/dashboard/page.tsx',['report_updates']);assert.match(html,/Aktivitas terbaru belum dapat dimuat/);assert.match(html,/reports:1/);assert.match(html,/Poin kamu:25/);});
test('daftar laporan membedakan kegagalan dari kosong',async()=>{assert.match((await renderPage('app/dashboard/reports/page.tsx',['reports?'])).html,/Laporan kamu belum dapat dimuat/);assert.match((await renderPage('app/dashboard/reports/page.tsx',[],true)).html,/reports:0/);});
test('detail gagal dimuat tidak disamakan dengan laporan tidak ditemukan',async()=>{assert.match((await renderPage('app/reports/[id]/page.tsx',['reports?'])).html,/Detail laporan belum dapat dimuat/);await assert.rejects(renderPage('app/reports/[id]/page.tsx',[],true),/not-found/);});
test('riwayat dan kepemilikan gagal tetap menampilkan detail tanpa tindakan pelapor',async()=>{const {html}=await renderPage('app/reports/[id]/page.tsx',['report_updates','submissions']);assert.match(html,/jalan rusak/);assert.match(html,/Riwayat progres belum dapat dimuat/);assert.match(html,/Data kontribusi kamu belum dapat dimuat/);assert.doesNotMatch(html,/Menemukan kerusakan yang sama|confirm-action/);});

for(const status of ['submitted','awaiting_confirmation','completed']) {
 test(`foto detail publik memakai preview bersama untuk status ${status}`,async()=>{
  const {html,requests}=await renderPage('app/reports/[id]/page.tsx',[],false,{anonymous:true,status,updates:[{id:'update-a',kind:'progress',message:'pekerjaan berlangsung',created_at:'2026-11-01',photo_path:'operator/private.jpg',progress:20}]});
  assert.ok(html.includes(reportPhotos.reportPhotoUrl({...report,status})));
  assert.match(html,new RegExp(status==='submitted'?'FOTO LAPORAN AWAL':'FOTO HASIL PERBAIKAN'));
  assert.doesNotMatch(html,/Masuk untuk melihat foto bukti|operator%2Fprivate|class="update-photo"/);
  assert.equal(requests.some(path=>path.includes('/submissions?')),false);
 });
}
test('foto riwayat tetap tersedia bagi pengguna yang sudah masuk',async()=>{
 const {html}=await renderPage('app/reports/[id]/page.tsx',[],false,{updates:[{id:'update-a',kind:'progress',message:'pekerjaan berlangsung',created_at:'2026-11-01',photo_path:'operator/private.jpg',progress:20}]});
 assert.match(html,/class="update-photo"/);
 assert.match(html,/operator%2Fprivate.jpg/);
 assert.ok(html.includes(reportPhotos.reportPhotoUrl(report)));
});
