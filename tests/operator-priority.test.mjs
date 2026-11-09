import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {missingDailyUpdate} from '../lib/rules.mjs';

function loadOperatorRoute(rpcImpl){
 const source=ts.transpileModule(
  readFileSync(new URL('../app/api/operator/route.ts',import.meta.url),'utf8'),
  {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}
 ).outputText;
 const modules={
  'next/server':{
   NextResponse:{
    json:(body,init)=>({status:init?.status??200,ok:(init?.status??200)<400,async json(){return body;}}),
   },
  },
  '@/lib/http':{
   authorize:async()=>({id:'op-1',role:'operator'}),
   failure:err=>({status:400,ok:false,async json(){return {error:err?.message||'Permintaan gagal.'};}}),
  },
  '@/lib/backend':{rpc:rpcImpl},
 };
 const exports={};
 vm.runInThisContext('(function(require,exports){'+source+'})')(name=>{
  if(!(name in modules))throw Error('missing mock '+name);
  return modules[name];
 },exports);
 return exports.POST;
}

test('aksi priority tidak pernah fallback ke reschedule atau progress jika migrasi belum terpasang',async()=>{
 const calls=[];
 const POST=loadOperatorRoute(async(name,payload)=>{
  calls.push({name,payload});
  throw new Error('Aksi tidak valid.');
 });
 const response=await POST({
  async json(){
   return {
    id:'11111111-1111-4111-8111-111111111111',
    action:'priority',
    priority:'urgent',
    status:'in_progress',
    progress:45,
    start_date:'2026-11-01',
    target_date:'2026-11-15',
    message:'Tingkat urgensi diubah menjadi Darurat melalui Peta Kendali.',
   };
  },
 });
 const body=await response.json();
 assert.equal(response.status,400);
 assert.equal(response.ok,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].payload.p_action,'priority');
 assert.match(body.error,/202611090001_operator_priority_update\.sql|belum tersedia/i);
});

test('aksi priority menolak nilai prioritas tidak valid sebelum memanggil RPC',async()=>{
 let called=false;
 const POST=loadOperatorRoute(async()=>{called=true;});
 for(const invalid of ['',null,undefined,'critical','tinggi']){
  const response=await POST({
   async json(){
    return {
     id:'11111111-1111-4111-8111-111111111111',
     action:'priority',
     priority:invalid,
     message:'Tingkat urgensi diubah melalui Peta Kendali.',
    };
   },
  });
  const body=await response.json();
  assert.equal(response.status,400);
  assert.match(body.error,/Prioritas tidak valid/i);
 }
 assert.equal(called,false);
});

test('simpan lalu refresh hanya mengubah prioritas tanpa mengubah dukungan, status, progres, jadwal, atau pembaruan harian',async()=>{
 const sql=readFileSync(new URL('../supabase/migrations/202611090001_operator_priority_update.sql',import.meta.url),'utf8');
 assert.match(sql,/elsif p_action='priority' then/);
 assert.match(sql,/last_update_at=case when p_action='priority' then r\.last_update_at else now\(\) end/);

 const now=new Date('2026-11-09T08:00:00Z');
 const dbReports=new Map([
  ['11111111-1111-4111-8111-111111111111',{
   id:'11111111-1111-4111-8111-111111111111',
   status:'in_progress',
   priority:'medium',
   progress:35,
   support_count:4,
   start_date:'2026-11-05',
   target_date:'2026-11-12',
   last_update_at:'2026-11-08T04:00:00Z',
  }],
 ]);
 const dbUpdates=[];

 const POST=loadOperatorRoute(async(name,p)=>{
  assert.equal(name,'operator_update');
  const r=dbReports.get(p.p_report_id);
  if(!r)throw new Error('Laporan tidak ditemukan.');
  if(p.p_action!=='priority')throw new Error('Unexpected action '+p.p_action);
  if(!['low','medium','high','urgent'].includes(p.p_priority))throw new Error('Prioritas tidak valid.');
  dbReports.set(r.id,{
   ...r,
   priority:p.p_priority,
  });
  dbUpdates.push({
   report_id:r.id,
   kind:p.p_action,
   message:p.p_message,
   progress:r.progress,
   previous_target:null,
   new_target:null,
  });
 });

 const before={...dbReports.get('11111111-1111-4111-8111-111111111111')};
 assert.equal(missingDailyUpdate(before,now),true);

 const res=await POST({
  async json(){
   return {
    id:before.id,
    action:'priority',
    priority:'urgent',
    message:'Tingkat urgensi diubah menjadi Darurat melalui Peta Kendali.',
   };
  },
 });
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{ok:true});

 const afterRefresh=dbReports.get(before.id);
 assert.equal(afterRefresh.priority,'urgent');
 assert.equal(afterRefresh.support_count,before.support_count);
 assert.equal(afterRefresh.status,before.status);
 assert.equal(afterRefresh.progress,before.progress);
 assert.equal(afterRefresh.start_date,before.start_date);
 assert.equal(afterRefresh.target_date,before.target_date);
 assert.equal(afterRefresh.last_update_at,before.last_update_at);
 assert.equal(missingDailyUpdate(afterRefresh,now),true);
 assert.equal(dbUpdates.length,1);
 assert.equal(dbUpdates[0].kind,'priority');
 assert.equal(dbUpdates[0].previous_target,null);
 assert.equal(dbUpdates[0].new_target,null);
});
