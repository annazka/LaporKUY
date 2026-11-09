import test from 'node:test';
import assert from 'node:assert/strict';
import {issueReportDraft,issueReportReceipt,verifyReportReceipt} from '../lib/report-draft.mjs';
import {REPORT_CATEGORIES} from '../lib/report-categories.mjs';
const user='11111111-1111-4111-8111-111111111111',photo=new Uint8Array([137,80,78,71,1]),mime='image/png',path=user+'/photo.png';
const options={secret:'fixture-private-signing-key',now:1000000};
const result={relevant:true,category:'Jembatan',summary:'Pagar pengaman jembatan tampak patah dan terlepas dari rangkanya.'};
test('all supported categories retain exact AI text through a user/photo-bound upload receipt',()=>{
 for(const category of REPORT_CATEGORIES){
  const token=issueReportDraft(user,photo,mime,{...result,category},options);
  const receipt=issueReportReceipt(token,user,photo,mime,path,options);
  assert.deepEqual(verifyReportReceipt(receipt,user,path,options),{category,description:result.summary});
 }
});
test('draft receipts reject changed image bytes, mime type, user, upload path or token scope',()=>{
 const token=issueReportDraft(user,photo,mime,result,options);
 assert.throws(()=>issueReportReceipt(token,user,new Uint8Array([137,80,78,71,2]),mime,path,options));
 assert.throws(()=>issueReportReceipt(token,user,photo,'image/jpeg',path,options));
 assert.throws(()=>issueReportReceipt(token,'another-user',photo,mime,path,options));
 assert.throws(()=>issueReportReceipt(token,user,photo,mime,'another-user/photo.png',options));
 assert.throws(()=>verifyReportReceipt(token,user,path,options));
 const receipt=issueReportReceipt(token,user,photo,mime,path,options);
 assert.throws(()=>verifyReportReceipt(receipt,user,user+'/other.png',options));
 assert.throws(()=>verifyReportReceipt(receipt,'another-user',path,options));
});
test('modified AI fields and invalid signatures cannot produce accepted report drafts',()=>{
 const token=issueReportDraft(user,photo,mime,result,options);
 const [payload,signature]=token.split('.');
 const forged=JSON.parse(Buffer.from(payload,'base64url').toString());forged.description='A user replaced the description with different report details.';
 const tampered=Buffer.from(JSON.stringify(forged)).toString('base64url')+'.'+signature;
 assert.throws(()=>issueReportReceipt(tampered,user,photo,mime,path,options));
 for(const invalid of [null,'',token+'.extra',payload+'.bad'])assert.throws(()=>issueReportReceipt(invalid,user,photo,mime,path,options));
 assert.throws(()=>issueReportReceipt(token,user,photo,mime,path,{...options,secret:'different-key'}));
});
test('expired analysis and upload receipts require reanalysis',()=>{
 const token=issueReportDraft(user,photo,mime,result,options);
 const receipt=issueReportReceipt(token,user,photo,mime,path,options);
 const expired={...options,now:options.now+30*60*1000};
 assert.throws(()=>issueReportReceipt(token,user,photo,mime,path,expired));
 assert.throws(()=>verifyReportReceipt(receipt,user,path,expired));
});
test('irrelevant images and incomplete model results cannot authorize report submission',()=>{
 assert.equal(issueReportDraft(user,photo,mime,{...result,relevant:false},options),null);
 for(const patch of [{category:'Tidak relevan'},{category:'Unknown'},{summary:'short'},{summary:'x'.repeat(3001)}])assert.throws(()=>issueReportDraft(user,photo,mime,{...result,...patch},options));
});
