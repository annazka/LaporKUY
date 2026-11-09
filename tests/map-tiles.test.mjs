import test from 'node:test';
import assert from 'node:assert/strict';
import {watchMapTiles} from '../lib/map-tiles.mjs';
function setup(timeout=12000){
 const states=[];let handlers={};
 const layer={on(events){handlers=events;},off(){handlers={};}};
 const stop=watchMapTiles(layer,state=>states.push(state),timeout);
 return {states,stop,emit:event=>handlers[event]?.()};
}
test('tile sukses mengakhiri loading tanpa error',()=>{const s=setup();s.emit('tileload');s.emit('load');assert.deepEqual(s.states.at(-1),{loading:false,error:''});s.stop();});
test('kegagalan sebagian tidak dianggap sukses',()=>{const s=setup();s.emit('tileload');s.emit('tileerror');s.emit('load');assert.match(s.states.at(-1).error,/Sebagian/);s.stop();});
test('seluruh tile gagal tetap menyatakan data laporan tersedia',()=>{const s=setup();s.emit('tileerror');s.emit('load');assert.match(s.states.at(-1).error,/Data laporan tetap tersedia/);s.stop();});
test('timeout tetap muncul meski satu tile sempat berhasil',async()=>{const s=setup(5);s.emit('tileload');await new Promise(resolve=>setTimeout(resolve,15));assert.match(s.states.at(-1).error,/Sebagian/);s.stop();});
test('batch berikutnya dapat pulih dari kegagalan',()=>{const s=setup();s.emit('tileerror');s.emit('load');s.emit('loading');s.emit('tileload');s.emit('load');assert.deepEqual(s.states.at(-1),{loading:false,error:''});s.stop();});
test('cleanup membatalkan timer dan event layer lama',async()=>{const s=setup(5);s.stop();const count=s.states.length;s.emit('tileerror');s.emit('load');await new Promise(resolve=>setTimeout(resolve,15));assert.equal(s.states.length,count);});
