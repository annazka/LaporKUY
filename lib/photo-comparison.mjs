import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {compareReportPhotos,GeminiError,validImage} from './gemini.mjs';
import {validatePhotoMatches} from './report-matching.mjs';
if(typeof window!=='undefined')throw Error('Photo comparison is server-only');
export async function prepareComparisonPhoto(photo){
 if(!validImage(photo.bytes,photo.mimeType))throw new GeminiError('Foto pembanding belum dapat dibaca. Foto laporan tetap tersedia.',422,'INVALID_COMPARISON_IMAGE');
 try{
  const bytes=await sharp(photo.bytes,{limitInputPixels:40000000}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();
  return {bytes,mimeType:'image/jpeg'};
 }catch{throw new GeminiError('Foto pembanding belum dapat dibaca. Foto laporan tetap tersedia.',422,'INVALID_COMPARISON_IMAGE');}
}
function photoKey(photo){return createHash('sha256').update(photo.mimeType).update(photo.bytes).digest('hex');}
export function createPhotoComparison({compare=compareReportPhotos,prepare=prepareComparisonPhoto,now=Date.now}={}){
 const cache=new Map(),jobs=new Map(),windows=new Map();
 function wait(job,signal){
  job.waiters++;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=(callback,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);job.waiters--;callback(value);if(!job.done&&job.waiters===0)job.controller.abort();};
   const abort=()=>finish(reject,new DOMException('Dibatalkan','AbortError'));
   if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
   job.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 }
 async function run(userId,photo,candidates,{signal}={}){
  signal?.throwIfAborted();if(!candidates.length)return [];
  const key=userId+':'+photoKey(photo)+':'+candidates.map(c=>c.id+':'+photoKey(c)).sort().join('|');
  for(const[id,item]of cache)if(now()-item.at>600000)cache.delete(id);
  if(cache.has(key))return cache.get(key).matches;
  const existing=jobs.get(key);if(existing&&!existing.controller.signal.aborted)return wait(existing,signal);
  const time=now();for(const[id,times]of windows)if(!times.some(at=>time-at<60000))windows.delete(id);
  const recent=(windows.get(userId)||[]).filter(at=>time-at<60000);
  if(recent.length>=6)throw new GeminiError('Terlalu banyak perbandingan foto. Tunggu sebentar lalu coba kirim lagi.',429,'COMPARISON_RATE_LIMITED',Math.max(1,Math.ceil((60000-time+recent[0])/1000)));
  windows.set(userId,[...recent,time]);
  if(jobs.size>=32)throw new GeminiError('Perbandingan foto sedang sibuk. Foto tetap tersedia; coba kirim lagi sebentar.',503,'COMPARISON_BUSY');
  const job={controller:new AbortController(),waiters:0,done:false,promise:null};
  job.promise=Promise.resolve().then(async()=>{
   const image=await prepare(photo),references=[];
   for(const candidate of candidates){job.controller.signal.throwIfAborted();references.push(await prepare(candidate));}
   job.controller.signal.throwIfAborted();
   const result=await compare(image,references.map((reference,index)=>({...reference,id:candidates[index].id})),{signal:job.controller.signal});
   job.controller.signal.throwIfAborted();const matches=validatePhotoMatches(result,candidates);
   if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),matches});return matches;
  }).finally(()=>{job.done=true;if(jobs.get(key)===job)jobs.delete(key);});
  jobs.set(key,job);return wait(job,signal);
 }
 return {run};
}
