import test from 'node:test';
import assert from 'node:assert/strict';
import {adminHost,queueMatches,auditCsv,voucherInput,operatorBanner} from '../lib/operator-data.mjs';
test('only the exact admin host uses the admin subdomain route',()=>{
 assert.equal(adminHost('admin.laporkuy.online'),true);assert.equal(adminHost('ADMIN.LAPORKUY.ONLINE:443'),true);
 for(const host of ['laporkuy.online','admin.laporkuy.online.attacker.test','notadmin.laporkuy.online',null])assert.equal(adminHost(host),false);
});
test('daily and overdue queues follow WIB and exclude closed reports',()=>{
 const now=new Date('2026-10-26T03:00:00Z'),r={status:'in_progress',start_date:'2026-10-25',target_date:'2026-10-25',last_update_at:'2026-10-25T03:00:00Z'};
 assert.equal(queueMatches(r,'daily',now),true);assert.equal(queueMatches(r,'overdue',now),true);
 assert.equal(queueMatches({...r,last_update_at:'2026-10-25T18:00:00Z'},'daily',now),false);
 for(const status of ['completed','rejected','awaiting_confirmation'])assert.equal(queueMatches({...r,status},'daily',now),false);
 assert.equal(queueMatches({...r,status:'completed'},'completed',now),true);
});
test('operational banner prioritizes unresolved high-priority cases and filters their queue',()=>{
 const now=new Date('2026-10-30T03:00:00Z');
 const routine={status:'in_progress',priority:'medium',start_date:'2026-10-29',target_date:'2026-10-29',last_update_at:'2026-10-29T03:00:00Z'};
 for(const priority of ['high','urgent']){
  const reports=[routine,{...routine,priority}];
  const banner=operatorBanner(reports,now);
  assert.equal(banner.kind,'danger');assert.equal(banner.queue,'severe');
  assert.equal(reports.filter(r=>queueMatches(r,banner.queue,now)).length,1);
 }
 for(const status of ['completed','rejected','awaiting_confirmation']){
  assert.equal(operatorBanner([{...routine,priority:'urgent',status}],now).kind,'success');
 }
 const warning=operatorBanner([routine],now);
 assert.equal(warning.kind,'warning');assert.equal(warning.queue,'attention');
 assert.match(warning.title,/1 laporan perlu pembaruan harian dan 1 melewati target/);
 const submitted=operatorBanner([{status:'submitted',priority:'medium'}],now);
 assert.equal(submitted.kind,'warning');assert.equal(submitted.queue,'submitted');
});
test('operational banner distinguishes no action from unavailable report data',()=>{
 const now=new Date('2026-10-30T03:00:00Z');
 assert.equal(operatorBanner([],now).kind,'success');
 assert.equal(operatorBanner([{status:'in_progress',priority:'medium',start_date:'2026-10-29',target_date:'2026-11-01',last_update_at:'2026-10-30T02:00:00Z'}],now).kind,'success');
 const failure=operatorBanner([{status:'in_progress',priority:'urgent'}],now,true);
 assert.equal(failure.kind,'unavailable');assert.equal(failure.queue,null);
});
test('CSV exports escape quotes, line breaks and spreadsheet formulas',()=>{
 const csv=auditCsv([{report_id:'abc',kind:'progress',message:'=HYPERLINK("bad")\nnew line'}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")\nnew line"'));
});
test('voucher writes validate user input before calling a privileged RPC',()=>{
 const id='11111111-1111-4111-8111-111111111111';assert.deepEqual(voucherInput({action:'stock',id,delta:-5}),{p_action:'stock',p_id:id,p_delta:-5});
 for(const delta of [0,1.1,10001,'10'])assert.throws(()=>voucherInput({action:'stock',id,delta}));
 const valid={action:'create',name:'Voucher uji',description:'Deskripsi voucher untuk pengujian.',category:'Edukasi',cost:100,stock:5,valid_until:'2027-12-31'};
 assert.equal(voucherInput(valid).p_cost,100);
 for(const patch of [{cost:0},{stock:-1},{valid_until:'2026-02-30'},{valid_until:'2026-99-01'},{name:'a'}])assert.throws(()=>voucherInput({...valid,...patch}));
});
