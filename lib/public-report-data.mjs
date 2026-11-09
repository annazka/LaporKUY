import {jakartaDate} from './rules.mjs';
// Fetch every page; never present a truncated response as the complete public dataset.
export async function loadPublicReports(fetchPage, asOf) {
 const rows=new Map();const size=200;
 for(let offset=0;;offset+=size){
  const page=await fetchPage(`/rest/v1/reports?select=*&created_at=lte.${encodeURIComponent(asOf)}&order=created_at.desc,id.desc&limit=${size}&offset=${offset}`);
  if(!Array.isArray(page))throw Error('Data laporan belum dapat dimuat.');
  for(const row of page)rows.set(row.id,row);
  if(page.length<size)break;
 }
 return [...rows.values()];
}
export function filterPublicReports(reports,{period='all',status='all',query=''},asOf) {
 const end=jakartaDate(new Date(asOf));
 const start=period==='all'?null:new Date(Date.parse(end+'T00:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10);
 const text=query.trim().toLocaleLowerCase('id-ID');
 return reports.filter(r=>{
  const day=jakartaDate(new Date(r.created_at));
  return day<=end&&(!start||day>=start)&&(status==='all'||r.status===status)&&(!text||`${r.title} ${r.address} ${r.category}`.toLocaleLowerCase('id-ID').includes(text));
 });
}
export function categoryCounts(reports) {
 const counts=new Map();for(const report of reports)counts.set(report.category,(counts.get(report.category)||0)+1);
 return [...counts].map(([category,count])=>({category,count})).sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category,'id-ID'));
}
export function reportTrend(reports,period,asOf) {
 const end=jakartaDate(new Date(asOf)),monthly=period==='all';
 const counts=new Map();for(const report of reports){const day=jakartaDate(new Date(report.created_at));const key=monthly?day.slice(0,7):day;counts.set(key,(counts.get(key)||0)+1);}
 const cursor=new Date(monthly?( [...counts.keys()].sort()[0]||end.slice(0,7))+'-01T00:00:00Z':Date.parse(end+'T00:00:00Z')-(Number(period)-1)*86400000);
 const finish=monthly?end.slice(0,7):end;const buckets=[];
 while(true){const key=cursor.toISOString().slice(0,monthly?7:10);if(key>finish)break;buckets.push({key,count:counts.get(key)||0});if(monthly)cursor.setUTCMonth(cursor.getUTCMonth()+1);else cursor.setUTCDate(cursor.getUTCDate()+1);}
 return buckets;
}
export function matchesTrend(report,key) {return jakartaDate(new Date(report.created_at)).startsWith(key);}
