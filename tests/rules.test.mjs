import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import * as rules from '../lib/rules.mjs';
const {jakartaDate,isOverdue,missingDailyUpdate,validCoordinates,safeNext}=rules;
function loadGetUrgency(){
 const source=ts.transpileModule(readFileSync(new URL('../components/peta-kendali.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};const modules={'react':{},'react/jsx-runtime':{},'next/navigation':{useRouter:()=>({})},'leaflet/dist/leaflet.css':{},'@/lib/map-tiles.mjs':{watchMapTiles:()=>()=>{}},'@/lib/rules.mjs':rules,'@/lib/types':{formatDate:()=>''},'./report-image':{ReportImage:()=>null}};
 vm.runInNewContext('(function(require,exports){'+source+'})')(name=>modules[name]||{},exports);
 return exports.getUrgency;
}
test('Jakarta day rollover uses UTC+7',()=>assert.equal(jakartaDate(new Date('2026-10-19T18:00:00Z')),'2026-10-20'));
test('overdue starts after target date and excludes completed or confirmation',()=>{const now=new Date('2026-10-20T03:00:00Z');assert.equal(isOverdue({target_date:'2026-10-19',status:'in_progress'},now),true);for(const status of ['completed','rejected','awaiting_confirmation'])assert.equal(isOverdue({target_date:'2026-10-19',status},now),false);assert.equal(isOverdue({target_date:'2026-10-20',status:'scheduled'},now),false);});
test('peta kendali urgency matches WIB overdue rules and does not escalate on target day',()=>{
 const getUrgency=loadGetUrgency();
 const sameDayEveningWib=new Date('2026-10-20T16:59:59Z');
 const nextDayMorningWib=new Date('2026-10-20T17:00:01Z');
 const scheduled={status:'scheduled',priority:'medium',target_date:'2026-10-20'};
 assert.equal(getUrgency(scheduled,sameDayEveningWib).key,'medium');
 assert.equal(getUrgency(scheduled,nextDayMorningWib).key,'urgent');
 for(const status of ['awaiting_confirmation','rejected'])assert.equal(getUrgency({...scheduled,status},nextDayMorningWib).key,'medium');
 assert.equal(getUrgency({...scheduled,status:'completed'},nextDayMorningWib).key,'completed');
});
test('daily update is required from repair start, including overdue days',()=>{const now=new Date('2026-10-20T03:00:00Z');const r={start_date:'2026-10-19',target_date:'2026-10-19',last_update_at:'2026-10-19T08:00:00Z',status:'in_progress'};assert.equal(missingDailyUpdate(r,now),true);assert.equal(missingDailyUpdate({...r,last_update_at:'2026-10-19T18:00:00Z'},now),false);assert.equal(missingDailyUpdate({...r,start_date:'2026-10-21'},now),false);assert.equal(missingDailyUpdate({...r,status:'completed'},now),false);});
test('location rejects invalid coordinates and outside Jakarta bounds',()=>{assert.equal(validCoordinates(-6.2088,106.8456),true);assert.equal(validCoordinates(NaN,106.8456),false);assert.equal(validCoordinates(0,0),false);});
test('redirect cannot escape local routes',()=>{assert.equal(safeNext('//evil.com'),'/dashboard');assert.equal(safeNext('/\\evil.com'),'/dashboard');assert.equal(safeNext('/reports/new'),'/reports/new');});
test('next preserves report intent and rejects redirects into auth, API and encoded escapes',()=>{for(const path of ['/reports/new','/profile','/dashboard/reports','/reports?status=completed'])assert.equal(safeNext(path),path);for(const path of ['/login','/register','/api/auth','https://evil.com','/%2f%2fevil.com','/reports/../../login','/dashboard\n','/dashboard\\evil'])assert.equal(safeNext(path),'/dashboard');});
