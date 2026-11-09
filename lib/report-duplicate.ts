import 'server-only';
import {backend,accessToken} from './backend';
import {GeminiError,validImage} from './gemini.mjs';
import {createPhotoComparison} from './photo-comparison.mjs';
import {choosePhotoMatch,nearbyCandidates,MATCH_RADIUS_METERS,MAX_COMPARISON_CANDIDATES} from './report-matching.mjs';
import type {Report} from './types';
type Candidate=Pick<Report,'id'|'category'|'status'|'latitude'|'longitude'|'photo_path'|'created_at'>;
const comparison=createPhotoComparison();
const photoPattern=/^[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/;
async function readPhoto(path:string,token:string,signal:AbortSignal,allowMissing=false){
 if(!photoPattern.test(path))throw new GeminiError('Foto laporan pembanding belum dapat dibaca. Foto Anda tetap tersedia.',502,'COMPARISON_PHOTO_UNAVAILABLE');
 const response=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/report-photos/${path}`,{cache:'no-store',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY!,Authorization:`Bearer ${token}`},signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
 if(response.status===404&&allowMissing)return null;
 if(!response.ok)throw new GeminiError('Foto laporan pembanding belum dapat dimuat. Foto Anda tetap tersedia; coba kirim lagi.',502,'COMPARISON_PHOTO_UNAVAILABLE');
 const mimeType=response.headers.get('content-type')?.split(';')[0]||'';
 if(Number(response.headers.get('content-length')||0)>4194304||!['image/jpeg','image/png','image/webp'].includes(mimeType))throw new GeminiError('Format foto pembanding belum dapat dibaca.',422,'INVALID_COMPARISON_IMAGE');
 const reader=response.body?.getReader();if(!reader)throw new GeminiError('Foto pembanding belum dapat dibaca.',502,'COMPARISON_PHOTO_UNAVAILABLE');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4194304){await reader.cancel();throw new GeminiError('Foto pembanding terlalu besar untuk dianalisis.',422,'INVALID_COMPARISON_IMAGE');}chunks.push(value);}
 const bytes=Buffer.concat(chunks);
 if(!validImage(bytes,mimeType))throw new GeminiError('Foto pembanding belum dapat dibaca.',422,'INVALID_COMPARISON_IMAGE');
 return {bytes,mimeType};
}
export async function findPhotoDuplicate({userId,category,latitude,longitude,photoPath,signal}:{userId:string;category:string;latitude:number;longitude:number;photoPath:string;signal:AbortSignal}){
 const token=await accessToken();if(!token)throw Error('Silakan masuk terlebih dahulu.');
 // The bounding box only limits I/O. Haversine distance is checked afterward.
 const latSpan=MATCH_RADIUS_METERS/110000,lngSpan=latSpan/Math.cos(latitude*Math.PI/180);
 const query=new URLSearchParams({select:'id,category,status,latitude,longitude,photo_path,created_at',category:`eq.${category}`,status:'not.in.(completed,rejected,awaiting_confirmation)',order:'created_at.asc',limit:'100'});
 query.append('latitude',`gte.${latitude-latSpan}`);query.append('latitude',`lte.${latitude+latSpan}`);query.append('longitude',`gte.${longitude-lngSpan}`);query.append('longitude',`lte.${longitude+lngSpan}`);
 const rows:Candidate[]=await backend('/rest/v1/reports?'+query.toString(),{signal},token);
 const candidates:(Candidate&{distance:number})[]=nearbyCandidates(rows,category,{latitude,longitude}).slice(0,MAX_COMPARISON_CANDIDATES);
 if(!candidates.length)return null;
 const [photo,...references]=await Promise.all([readPhoto(photoPath,token,signal),...candidates.map(candidate=>readPhoto(candidate.photo_path,token,signal,true))]).catch((error:unknown)=>{
  if(signal.aborted)throw signal.reason;
  if(error instanceof GeminiError)throw error;
  throw new GeminiError('Foto pembanding belum dapat dimuat. Foto Anda tetap tersedia; coba kirim laporan lagi.',502,'COMPARISON_PHOTO_UNAVAILABLE');
 });
 if(!photo)throw Error('Foto laporan belum dapat dibaca.');
 const available=references.flatMap((reference,index)=>reference?[{...candidates[index],...reference}]:[]);
 // A missing old photo is not evidence of a duplicate; never upvote by proximity alone.
 if(!available.length)return null;
 const matches=await comparison.run(userId,photo,available,{signal});
 return choosePhotoMatch(matches,available);
}
