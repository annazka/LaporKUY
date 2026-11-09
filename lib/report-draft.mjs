import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {REPORT_CATEGORIES} from './report-categories.mjs';
if(typeof window!=='undefined')throw Error('Report drafts are server-only');
const TTL=30*60*1000;
const message='Hasil AI tidak berlaku atau sudah kedaluwarsa. Analisis ulang foto sebelum mengirim laporan.';
function signingKey(secret){
 if(!secret||secret==='[SENSITIVE]')throw Error('Konfigurasi AI belum tersedia. Coba analisis foto kembali.');
 // A domain-separated signing key; the provider credential never leaves the server.
 return createHmac('sha256',secret).update('laporkuy-report-draft:v1').digest();
}
function sign(claims,secret){
 const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return payload+'.'+createHmac('sha256',signingKey(secret)).update(payload).digest('base64url');
}
function read(token,userId,kind,{secret=process.env.GEMINI_API_KEY,now=Date.now()}={}){
 if(typeof token!=='string'||token.length>16000)throw Error(message);
 const parts=token.split('.');if(parts.length!==2||parts.some(p=>!p||!/^[\w-]+$/.test(p)))throw Error(message);
 const signature=Buffer.from(parts[1],'base64url');
 const expected=createHmac('sha256',signingKey(secret)).update(parts[0]).digest();
 if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw Error(message);
 let value;try{value=JSON.parse(Buffer.from(parts[0],'base64url').toString());}catch{throw Error(message);}
 if(!value||value.version!==1||value.kind!==kind||value.userId!==userId||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||!REPORT_CATEGORIES.includes(value.category)||typeof value.description!=='string'||value.description.length<20||value.description.length>3000||!/^[a-f0-9]{64}$/.test(value.photoHash||''))throw Error(message);
 return value;
}
export function reportPhotoHash(bytes,mimeType){return createHash('sha256').update(mimeType).update(bytes).digest('hex');}
export function issueReportDraft(userId,bytes,mimeType,analysis,{secret=process.env.GEMINI_API_KEY,now=Date.now()}={}){
 if(!analysis.relevant)return null;
 const description=analysis.summary?.trim();
 if(!REPORT_CATEGORIES.includes(analysis.category)||!description||description.length<20||description.length>3000)throw Error('AI belum menghasilkan kategori dan deskripsi laporan yang lengkap. Coba analisis kembali.');
 return sign({version:1,kind:'analysis',userId,photoHash:reportPhotoHash(bytes,mimeType),category:analysis.category,description,expiresAt:now+TTL},secret);
}
export function issueReportReceipt(token,userId,bytes,mimeType,photoPath,options={}){
 const value=read(token,userId,'analysis',options);
 if(value.photoHash!==reportPhotoHash(bytes,mimeType)||typeof photoPath!=='string'||!photoPath.startsWith(userId+'/'))throw Error(message);
 return sign({...value,kind:'upload',photoPath},options.secret??process.env.GEMINI_API_KEY);
}
export function verifyReportReceipt(token,userId,photoPath,options={}){
 const value=read(token,userId,'upload',options);
 if(value.photoPath!==photoPath||!String(photoPath).startsWith(userId+'/'))throw Error(message);
 return {category:value.category,description:value.description};
}
