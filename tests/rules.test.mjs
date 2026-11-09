import test from 'node:test';import assert from 'node:assert/strict';import {jakartaDate,isOverdue,missingDailyUpdate,validCoordinates,safeNext} from '../lib/rules.mjs';
test('Jakarta day rollover uses UTC+7',()=>assert.equal(jakartaDate(new Date('2026-10-19T18:00:00Z')),'2026-10-20'));
test('overdue starts after target date and excludes completed or confirmation',()=>{const now=new Date('2026-10-20T03:00:00Z');assert.equal(isOverdue({target_date:'2026-10-19',status:'in_progress'},now),true);for(const status of ['completed','rejected','awaiting_confirmation'])assert.equal(isOverdue({target_date:'2026-10-19',status},now),false);assert.equal(isOverdue({target_date:'2026-10-20',status:'scheduled'},now),false);});
test('daily update is required from repair start, including overdue days',()=>{const now=new Date('2026-10-20T03:00:00Z');const r={start_date:'2026-10-19',target_date:'2026-10-19',last_update_at:'2026-10-19T08:00:00Z',status:'in_progress'};assert.equal(missingDailyUpdate(r,now),true);assert.equal(missingDailyUpdate({...r,last_update_at:'2026-10-19T18:00:00Z'},now),false);assert.equal(missingDailyUpdate({...r,start_date:'2026-10-21'},now),false);assert.equal(missingDailyUpdate({...r,status:'completed'},now),false);});
test('location rejects invalid coordinates and outside Jakarta bounds',()=>{assert.equal(validCoordinates(-6.2088,106.8456),true);assert.equal(validCoordinates(NaN,106.8456),false);assert.equal(validCoordinates(0,0),false);});
test('redirect cannot escape local routes',()=>{assert.equal(safeNext('//evil.com'),'/dashboard');assert.equal(safeNext('/\\evil.com'),'/dashboard');assert.equal(safeNext('/reports/new'),'/reports/new');});
test('next preserves report intent and rejects redirects into auth, API and encoded escapes',()=>{for(const path of ['/reports/new','/profile','/dashboard/reports','/reports?status=completed'])assert.equal(safeNext(path),path);for(const path of ['/login','/register','/api/auth','https://evil.com','/%2f%2fevil.com','/reports/../../login','/dashboard\n','/dashboard\\evil'])assert.equal(safeNext(path),'/dashboard');});

test('login voucher mempertahankan tujuan katalog dan parameter pencarian',()=>{
 for(const path of ['/profile/vouchers','/profile/vouchers?category=makanan'])assert.equal(safeNext(path),path);
});
test('penambahan katalog tidak mengizinkan rute lain atau redirect eksternal',()=>{
 for(const path of ['/profile/settings','/profile/vouchers/extra','//evil.com/profile/vouchers','/profile/%2fvouchers','/profile/vouchers/../../api/auth','/profile/vouchers\\evil.com'])assert.equal(safeNext(path),'/dashboard');
});
