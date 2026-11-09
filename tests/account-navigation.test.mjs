import test from 'node:test';
import assert from 'node:assert/strict';
import {accountLinks,headerLinks} from '../lib/account-navigation.mjs';
import {safeNext} from '../lib/rules.mjs';
test('seluruh tujuan navigasi akun dipertahankan setelah login',()=>{
 for(const {href} of accountLinks)assert.equal(safeNext(href),href);
});
test('navbar hanya berisi dashboard, jelajah laporan, dan voucher untuk semua peran',()=>{
 const expected=[{href:'/dashboard',label:'Dashboard'},{href:'/profile/reports',label:'Jelajahi laporan'},{href:'/profile/vouchers',label:'Voucher'}];
 for(const signedIn of [false,true])for(const operator of [false,true])assert.deepEqual(headerLinks(signedIn,operator),expected);
});
test('sidebar hanya berisi halaman dashboard dan pengelolaan akun',()=>{
 assert.deepEqual(accountLinks.map(link=>link.href),['/dashboard','/dashboard/reports','/reports/new','/profile']);
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
test('navbar menandai dashboard untuk halaman laporan saya tanpa menu duplikat',()=>{
 const html=renderNav('main-nav.tsx','MainNav','/dashboard/reports',{signedIn:true,operator:false});
 assert.match(html,/<a href="\/dashboard" aria-current="page">Dashboard/);
 assert.doesNotMatch(html,/href="\/dashboard\/reports"|href="\/operator"/);
});
test('sidebar menandai halaman akun aktif tanpa jelajah atau voucher',()=>{
 for(const path of accountLinks.map(link=>link.href)) {
  const html=renderNav('dashboard-nav.tsx','DashboardNav',path);
  assert.match(html,new RegExp('class="active" aria-current="page" href="'+path+'"'));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.doesNotMatch(html,/href="\/profile\/(?:reports|vouchers)"/);
 }
});
