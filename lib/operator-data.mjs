import {isOverdue,missingDailyUpdate} from './rules.mjs';
export const operatorViews=[['ringkasan','Ringkasan'],['antrean','Antrean penanganan'],['peta','Peta kendali'],['voucher','Manajemen voucher'],['audit','Audit log']];
export function adminHost(host){return String(host||'').split(':')[0].toLowerCase()==='admin.laporkuy.online';}
export function queueMatches(report,tab,now=new Date()){
 if(tab==='severe')return ['high','urgent'].includes(report.priority)&&!['completed','rejected','awaiting_confirmation'].includes(report.status);
 if(tab==='daily')return missingDailyUpdate(report,now);
 if(tab==='overdue'||tab==='attention')return isOverdue(report,now)||(tab==='attention'&&missingDailyUpdate(report,now));
 if(tab==='active')return ['verified','scheduled','in_progress'].includes(report.status);
 return tab==='all'||report.status===tab;
}
export function operatorBanner(reports,now=new Date(),failed=false){
 if(failed)return {kind:'unavailable',title:'Status laporan belum dapat diperiksa.',description:'Muat ulang untuk memeriksa laporan yang perlu ditindaklanjuti.',action:'Muat ulang',queue:null};
 const count=tab=>reports.filter(r=>queueMatches(r,tab,now)).length;
 const severe=count('severe'),daily=count('daily'),overdue=count('overdue'),submitted=count('submitted');
 if(severe)return {kind:'danger',title:`Prioritas tinggi: ${severe} laporan perlu penanganan.`,description:'Periksa laporan berprioritas tinggi atau darurat sebelum penanganan lainnya.',action:'Periksa laporan',queue:'severe'};
 if(daily||overdue)return {kind:'warning',title:`Perhatian operasional: ${daily} laporan perlu pembaruan harian dan ${overdue} melewati target selesai.`,description:'Pembaruan progres diperlukan setiap hari sejak pekerjaan dimulai.',action:'Tangani prioritas',queue:'attention'};
 if(submitted)return {kind:'warning',title:`${submitted} laporan menunggu verifikasi.`,description:'Periksa bukti dan tentukan tindak lanjut untuk laporan baru.',action:'Verifikasi laporan',queue:'submitted'};
 return {kind:'success',title:'Tidak ada tindakan tertunda.',description:'Tidak ada laporan prioritas tinggi, verifikasi baru, pembaruan harian tertunda, atau target yang terlewati.',action:'Lihat laporan',queue:'all'};
}
export function auditCsv(rows){
 const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[['Waktu','ID laporan / voucher','Tindakan','Keterangan','Target sebelumnya','Target baru'],...rows.map(r=>[r.created_at,r.report_id||r.voucher_id,r.kind,r.message,r.previous_target,r.new_target])].map(row=>row.map(cell).join(',')).join('\r\n');
}
export function voucherInput(body){
 if(body.action==='stock'){
  if(!/^[a-f0-9-]{36}$/i.test(body.id||'')||!Number.isInteger(body.delta)||!body.delta||Math.abs(body.delta)>10000)throw Error('Perubahan stok tidak valid.');
  return {p_action:'stock',p_id:body.id,p_delta:body.delta};
 }
 if(body.action!=='create')throw Error('Tindakan tidak valid.');
 const name=String(body.name||'').trim(),description=String(body.description||'').trim(),category=String(body.category||'').trim();
 const date=String(body.valid_until||'');
 const parsedDate=new Date(date);const validDate=Number.isFinite(parsedDate.getTime())&&parsedDate.toISOString().slice(0,10)===date;
 if(name.length<3||name.length>140||description.length<10||description.length>1000||!category||category.length>80||!Number.isInteger(body.cost)||body.cost<1||body.cost>1000000||!Number.isInteger(body.stock)||body.stock<0||body.stock>1000000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!validDate)throw Error('Lengkapi nama, deskripsi, kategori, poin, stok, dan masa berlaku yang valid.');
 return {p_action:'create',p_name:name,p_description:description,p_category:category,p_cost:body.cost,p_stock:body.stock,p_valid_until:date};
}
