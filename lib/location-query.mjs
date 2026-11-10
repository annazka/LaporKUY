import {validCoordinates} from './rules.mjs';
export function coordinateInput(value){
 if(typeof value!=='string')return null;
 const match=value.trim().replace(/^koordinat\s+/i,'').match(/^\(?\s*([+-]?\d+(?:\.\d+)?)\s*(?:,|;|\s)\s*([+-]?\d+(?:\.\d+)?)\s*\)?$/);
 if(!match)return null;
 const a=Number(match[1]),b=Number(match[2]);
 if(validCoordinates(a,b))return {latitude:a,longitude:b};
 if(validCoordinates(b,a))return {latitude:b,longitude:a};
 const error=new Error('Koordinat berada di luar cakupan peta Jakarta. Gunakan format lintang, bujur; contoh -6.200000, 106.830000.');error.status=400;throw error;
}
export function detailedAddress(query){return query.split(',').length>=3||/\b(?:RT\.?\s*\d|RW\.?\s*\d|Blok\s|No\.?\s*\d)/i.test(query);}
export function addressVariants(query){
 const normalized=query.replace(/\bGg\.?\s+/gi,'Gang ').replace(/\bPs\.?\s*Minggu\b/gi,'Pasar Minggu').replace(/\bJl\.?\s+/gi,'Jalan ').replace(/\bKota\s+Jakarta/gi,'Jakarta').replace(/Daerah Khusus Ibukota Jakarta/gi,'Jakarta');
 if(!detailedAddress(query))return [...new Set([query,normalized])];
 const parts=normalized.split(',').map(p=>p.replace(/\bRT\.?\s*\d+\s*(?:\/\s*)?RW\.?\s*\d+/gi,'').replace(/\b\d{5}\b/g,'').trim()).filter(p=>p&&!/^(?:Indonesia|Jakarta)$/i.test(p));
 const street=(parts[0]||'').replace(/\bBlok\s+.*?(?=\bNo\.?\s*\d|$)/gi,'').replace(/[.'’]/g,'').replace(/\s+/g,' ').trim();
 const locality=parts.slice(1).join(', ');
 const withoutNumber=street.replace(/\bNo\s*\d+[\w/-]*/gi,'').trim();
 return [...new Set([query,[street,locality].filter(Boolean).join(', '),[withoutNumber,locality].filter(Boolean).join(', '),locality].filter(q=>q.length>=3))].slice(0,4);
}
