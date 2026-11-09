import test from 'node:test';
import assert from 'node:assert/strict';
import {accountLinks,headerLinks} from '../lib/account-navigation.mjs';
import {safeNext} from '../lib/rules.mjs';
test('seluruh tujuan navigasi akun dipertahankan setelah login',()=>{
 for(const {href} of accountLinks)assert.equal(safeNext(href),href);
});
test('menu warga menyediakan laporan saya, jelajah dan voucher dengan tujuan akun',()=>{
 const links=headerLinks(true);
 for(const href of ['/dashboard','/dashboard/reports','/profile/reports','/profile/vouchers'])assert.ok(links.some(link=>link.href===href));
 assert.equal(links.some(link=>link.href==='/operator'),false);
 assert.equal(new Set(links.map(link=>link.href)).size,links.length);
});
test('menu operator hanya tersedia untuk pengguna masuk dengan peran operator',()=>{
 assert.ok(headerLinks(true,true).some(link=>link.href==='/operator'));
 for(const operator of [false,true])assert.deepEqual(headerLinks(false,operator),[{href:'/#laporan',label:'Jelajahi laporan'}]);
});

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as navigation from '../lib/account-navigation.mjs';
const jsx=await import('react/jsx-runtime');
function renderNav(file,name,path,props={}) {
 const modules={'react':React,'react/jsx-runtime':jsx,'next/link':{__esModule:true,default:({children,...rest})=>React.createElement('a',rest,children)},'next/navigation':{usePathname:()=>path},'@/lib/account-navigation.mjs':navigation};
 const source=ts.transpileModule(readFileSync(new URL('../components/'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext('(function(require,exports){'+source+'})')(name=>modules[name],exports);
 return renderToStaticMarkup(React.createElement(exports[name],props));
}
test('navbar menandai halaman tepat tanpa menandai dashboard pada halaman laporan',()=>{
 const html=renderNav('main-nav.tsx','MainNav','/dashboard/reports',{signedIn:true,operator:false});
 assert.match(html,/<a href="\/dashboard\/reports" aria-current="page">Laporan saya/);
 assert.doesNotMatch(html,/<a href="\/dashboard" aria-current/);
 assert.doesNotMatch(html,/href="\/operator"/);
});
test('sidebar jelajah dan voucher memiliki tujuan yang sama dan status aktif tepat',()=>{
 for(const path of ['/profile/reports','/profile/vouchers']) {
  const html=renderNav('dashboard-nav.tsx','DashboardNav',path);
  assert.match(html,new RegExp('class="active" aria-current="page" href="'+path+'"'));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 }
});
