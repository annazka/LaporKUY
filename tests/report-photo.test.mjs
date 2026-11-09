import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPhotoPath,reportPhotoUrl,reportPhotoAlt,usesRepairPhoto} from '../lib/report-photo.mjs';
const report={id:'case-a',title:'Jalan berlubang',photo_path:'citizen/original.jpg',status:'completed',last_update_at:'2026-10-30T08:00:00Z'};
const update=(id,kind,path,time='2026-10-30T08:00:00Z',report_id=report.id)=>({id,kind,photo_path:path,created_at:time,report_id});
test('finished and awaiting-confirmation cases use the latest finish photo, not a later progress photo',()=>{
 const updates=[update('1','finish','operator/old.jpg','2026-10-29T08:00:00Z'),update('2','finish','operator/new.jpg'),update('3','progress','operator/progress.jpg','2026-10-31T08:00:00Z'),update('4','finish','other/case.jpg','2026-10-31T09:00:00Z','case-b')];
 for(const status of ['completed','awaiting_confirmation'])assert.equal(reportPhotoPath({...report,status},updates),'operator/new.jpg');
});
test('active, reopened and rejected cases keep original evidence, without mutating the record',()=>{
 const updates=[update('1','finish','operator/old.jpg')];
 for(const status of ['submitted','verified','scheduled','in_progress','rejected'])assert.equal(reportPhotoPath({...report,status},updates),report.photo_path);
 assert.equal(report.photo_path,'citizen/original.jpg');
});
test('missing finish evidence never falls back to a damage photo for a repaired case',()=>{
 assert.equal(reportPhotoPath(report,[]),null);assert.equal(reportPhotoPath(report,[update('1','finish',null)]),null);
 assert.equal(reportPhotoPath(report,[update('1','progress','operator/progress.jpg')]),null);
});
test('equal timestamps use the same descending ID tie-break as the database',()=>{
 assert.equal(reportPhotoPath(report,[update('a','finish','operator/a.jpg'),update('b','finish','operator/b.jpg')]),'operator/b.jpg');
});
test('photo URLs change with report state/update and alt text describes the actual phase',()=>{
 assert.notEqual(reportPhotoUrl(report),reportPhotoUrl({...report,status:'in_progress'}));
 assert.notEqual(reportPhotoUrl(report),reportPhotoUrl({...report,last_update_at:'2026-10-31T08:00:00Z'}));
 assert.match(reportPhotoAlt(report),/^Hasil perbaikan:/);assert.match(reportPhotoAlt({...report,status:'in_progress'}),/^Kondisi kerusakan:/);
 assert.equal(usesRepairPhoto('awaiting_confirmation'),true);
});
