export function usesRepairPhoto(status){return status==='completed'||status==='awaiting_confirmation';}
export function reportPhotoPath(report,updates=[]){
 if(!usesRepairPhoto(report.status))return report.photo_path||null;
 const finish=updates.filter(u=>u.report_id===report.id&&u.kind==='finish'&&typeof u.photo_path==='string'&&u.photo_path.trim())
  .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||String(b.id).localeCompare(String(a.id)))[0];
 return finish?.photo_path||null;
}
export function reportPhotoUrl(report){
 const version=[report.status,report.last_update_at||''].join(':');
 return `/api/report-preview/${encodeURIComponent(report.id)}?v=${encodeURIComponent(version)}`;
}
export function reportPhotoAlt(report){return `${usesRepairPhoto(report.status)?'Hasil perbaikan':'Kondisi kerusakan'}: ${report.title}`;}
