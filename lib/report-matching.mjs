export const MATCH_RADIUS_METERS=25;
export const MIN_VISUAL_CONFIDENCE=0.9;
export const MAX_COMPARISON_CANDIDATES=5;
const closed=new Set(['completed','rejected','awaiting_confirmation']);
export function distanceMeters(a,b){
 const values=[a.latitude,a.longitude,b.latitude,b.longitude];if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)))return Infinity;
 const rad=v=>v*Math.PI/180,lat=rad(b.latitude-a.latitude),lng=rad(b.longitude-a.longitude);
 const h=Math.sin(lat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(lng/2)**2;
 return 2*6371000*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function nearbyCandidates(reports,category,point){
 return reports.map(report=>({...report,distance:distanceMeters(point,report)}))
  .filter(report=>report.category===category&&!closed.has(report.status)&&report.distance<=MATCH_RADIUS_METERS)
  .sort((a,b)=>a.distance-b.distance||Date.parse(a.created_at)-Date.parse(b.created_at));
}
export function validatePhotoMatches(value,candidates){
 if(!value||!Array.isArray(value.matches)||value.matches.length!==candidates.length)throw Error('INVALID_COMPARISON');
 const ids=new Set(candidates.map(c=>c.id)),seen=new Set();
 for(const match of value.matches){
  if(!match||!ids.has(match.report_id)||seen.has(match.report_id)||typeof match.same_damage!=='boolean'||typeof match.confidence!=='number'||!Number.isFinite(match.confidence)||match.confidence<0||match.confidence>1||typeof match.reason!=='string'||!match.reason.trim()||match.reason.length>2000)throw Error('INVALID_COMPARISON');
  seen.add(match.report_id);
 }
 return value.matches;
}
export function choosePhotoMatch(matches,candidates){
 const eligible=[];
 for(const match of matches){
  const report=candidates.find(c=>c.id===match.report_id);
  if(!report||report.distance<0||report.distance>MATCH_RADIUS_METERS||!match.same_damage||match.confidence<MIN_VISUAL_CONFIDENCE)continue;
  const proximity=1-report.distance/MATCH_RADIUS_METERS;
  eligible.push({report_id:report.id,visual_confidence:match.confidence,distance:report.distance,confidence:match.confidence*.9+proximity*.1});
 }
 eligible.sort((a,b)=>b.confidence-a.confidence||a.distance-b.distance||a.report_id.localeCompare(b.report_id));
 return eligible[0]||null;
}
