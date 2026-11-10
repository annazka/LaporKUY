import {validCoordinates} from './rules.mjs';
import {coordinateInput,addressVariants,detailedAddress} from './location-query.mjs';
export function addressQuery(value){
 if(typeof value!=='string')return null;
 const query=value.trim().replace(/\s+/g,' ');
 return query.length>=3&&query.length<=300&&!/[\x00-\x1f\x7f]/.test(value)?query:null;
}
export function addressResults(data){
 if(!data||!Array.isArray(data.features))throw Error('INVALID_GEOCODING_RESPONSE');
 const seen=new Set(),results=[];
 for(const feature of data.features){
  const coordinates=feature?.geometry?.coordinates,p=feature?.properties;
  if(feature?.geometry?.type!=='Point'||!Array.isArray(coordinates)||!p)continue;
  const [longitude,latitude]=coordinates;if(!validCoordinates(latitude,longitude))continue;
  const street=[p.street,p.housenumber].filter(v=>typeof v==='string'&&v.trim()).join(' ');
  const label=[...new Set([p.name,street,p.district,p.city,p.state,p.country].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))].join(', ').slice(0,300);
  if(label.length<8)continue;
  const id=`${latitude}:${longitude}:${label}`;if(seen.has(id))continue;seen.add(id);
  results.push({id,label,latitude,longitude});if(results.length===5)break;
 }
 return results;
}
export function createAddressSearch({fetcher=fetch,now=Date.now,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const cache=new Map();let nextRequest=0;
 return async function search(query){
  const point=coordinateInput(query);
  if(point)return [{id:`coordinates:${point.latitude}:${point.longitude}`,label:`Koordinat ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,...point,approximate:false}];
  const key=query.toLocaleLowerCase('id-ID'),time=now(),cached=cache.get(key);
  if(cached&&cached.expires>time)return cached.results;
  if(time<nextRequest){const e=new Error('Tunggu sebentar sebelum mencari alamat lagi.');e.status=429;throw e;}
  const deadline=AbortSignal.timeout(20000),variants=addressVariants(query);let results=[];
  for(let index=0;index<variants.length;index++){
   const slot=Math.max(now(),nextRequest);nextRequest=slot+1000;
   if(slot>now())await pause(slot-now());
   deadline.throwIfAborted();
   const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({q:variants[index],limit:'5',bbox:'106.65,-6.5,107,-6.05'}).toString();
   const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'LaporKUY/1.0 (https://laporkuy.online)'},signal:AbortSignal.any([deadline,AbortSignal.timeout(8000)]),cache:'no-store'});
   if(response.status===429){const e=new Error('Pencarian alamat sedang sibuk. Coba lagi sebentar.');e.status=429;throw e;}
   if(!response.ok)throw Error('GEOCODING_UNAVAILABLE');
   results=addressResults(await response.json()).map(r=>({...r,approximate:index>0||detailedAddress(query),preserveInput:detailedAddress(query)}));
   if(results.length)break;
  }
  if(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(key,{results,expires:now()+600000});return results;
 };
}
