'use client';
import Link from 'next/link';
import {ReportImage} from './report-image';
import {useEffect,useRef,useState} from 'react';
import {MapPin,LocateFixed,ArrowUpRight,X} from 'lucide-react';
import type {Report} from '@/lib/types';
import {statusLabels,formatDate} from '@/lib/types';
import {relativeTime} from '@/lib/relative-time.mjs';
import {validCoordinates} from '@/lib/rules.mjs';
import type {Map as LeafletMap} from 'leaflet';

export function LandingMap({reports,failed}:{reports:Report[];failed:boolean}){
 const [loading,setLoading]=useState(true),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<string|null>(null),[location,setLocation]=useState<[number,number]|null>(null),[locating,setLocating]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [now,setNow]=useState<number|null>(null);
 const canvas=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),request=useRef(0);
 const located=reports.filter(r=>validCoordinates(r.latitude,r.longitude)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const filtered=located.filter(r=>filter==='completed'?r.status==='completed':filter==='active'?['verified','scheduled','in_progress','awaiting_confirmation'].includes(r.status):filter==='nearby'&&location?Math.hypot((r.latitude-location[0])*111,(r.longitude-location[1])*110)<=5:true);
 const chosen=filtered.find(r=>r.id===selected)||null;
 useEffect(()=>{
  const refresh=()=>setNow(Date.now());
  refresh();
  const timer=setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 // Rebuild only when data/filter changes, never for clock ticks or scrolling.
 const signature=JSON.stringify(filtered.map(r=>[r.id,r.latitude,r.longitude,r.title]));
 useEffect(()=>{
  if(!canvas.current)return;
  let disposed=false;let instance:LeafletMap|undefined;let resize:ResizeObserver|undefined;
  setError('');setLoading(true);
  import('leaflet').then(L=>{
   if(disposed||!canvas.current)return;
   instance=L.map(canvas.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView(location||[-6.2,106.83],11);map.current=instance;
   resize=new ResizeObserver(()=>instance?.invalidateSize({animate:false}));resize.observe(canvas.current);
   const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(instance);
   let tileFailed=false;
   tiles.on('tileerror',()=>{tileFailed=true;if(!disposed){setLoading(false);setError('Peta dasar belum dapat dimuat. Daftar laporan tetap bisa dibuka.');}});
   tiles.on('load',()=>{if(!disposed){setLoading(false);if(!tileFailed)setError('');}});
   const rows=filtered;
   rows.forEach(r=>{
    const marker=L.marker([r.latitude,r.longitude],{icon:L.divIcon({className:'report-map-marker',html:'<span aria-hidden="true"></span>',iconSize:[30,30],iconAnchor:[15,15]}),title:r.title,alt:`Laporan: ${r.title}`}).addTo(instance!);
    marker.on('click',()=>setSelected(r.id));
   });
   if(location)L.circleMarker(location,{radius:7,color:'#fff',fillColor:'#555',fillOpacity:1}).addTo(instance);
   const focus=rows.find(r=>r.id===selected);
   if(focus)instance.setView([focus.latitude,focus.longitude],14);
   else if(rows.length)instance.fitBounds(L.latLngBounds(rows.map(r=>[r.latitude,r.longitude] as [number,number])),{padding:[55,55],maxZoom:14});
  }).catch(()=>{if(!disposed){setLoading(false);setError('Peta belum dapat dibuka. Coba lagi.');}});
  return()=>{disposed=true;resize?.disconnect();instance?.stop();instance?.remove();map.current=null;};
 },[signature,location,attempt]);
 useEffect(()=>{if(chosen)map.current?.panTo([chosen.latitude,chosen.longitude],{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});},[chosen?.id]);
 useEffect(()=>()=>{request.current++;},[]);
 function nearby(){
  if(location){setFilter('nearby');return;}
  if(!navigator.geolocation){setError('Browser ini belum mendukung lokasi. Gunakan filter status.');return;}
  const id=++request.current;setLocating(true);setError('');
  navigator.geolocation.getCurrentPosition(p=>{if(id!==request.current)return;setLocation([p.coords.latitude,p.coords.longitude]);setFilter('nearby');setLocating(false);},()=>{if(id!==request.current)return;setLocating(false);setError('Lokasi belum dapat diakses. Izinkan lokasi di browser atau gunakan filter status.');},{timeout:10000,maximumAge:60000});
 }
 return <section id="peta" className="container section landing-map-section" aria-labelledby="map-title"><div className="section-heading"><div><h2 id="map-title">Peta laporan Jakarta</h2></div></div>
 <div className="map-toolbar" role="group" aria-label="Filter peta laporan">{[['all','Semua laporan'],['active','Dalam penanganan'],['completed','Selesai']].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>{setFilter(value);setSelected(null);}}>{label}</button>)}<button type="button" aria-pressed={filter==='nearby'} disabled={locating} onClick={nearby}><LocateFixed size={15}/>{locating?'Mencari lokasi…':'Sekitar saya'}</button></div>
 {error&&<p className="map-error" role="status">{error} <button type="button" onClick={()=>setAttempt(n=>n+1)}>Coba lagi</button></p>}
 <div className="landing-map-panel"><div className="map-viewport" aria-busy={loading}><div ref={canvas} className="report-map-canvas" aria-label="Peta lokasi laporan Jakarta"/>{loading&&<p className="map-loading" role="status">Memuat peta…</p>} {chosen&&<article className="map-detail"><button className="map-detail-close" type="button" aria-label="Tutup detail laporan di peta" onClick={()=>setSelected(null)}><X size={18}/></button><ReportImage report={chosen} style={{width:'100%',height:130,objectFit:'cover'}}/><div><small>{statusLabels[chosen.status]||chosen.status}</small><h3>{chosen.title}</h3><p>{chosen.address}</p><progress value={chosen.progress} max={100} aria-label="Progres perbaikan"/><p>{chosen.progress}% progres</p><Link className="text-button" href={`/reports/${chosen.id}`}>Lihat detail laporan <ArrowUpRight size={16}/></Link></div></article>}</div>
 <aside className="map-report-list" aria-label="Daftar laporan pada peta"><div className="map-list-heading"><strong>{filter==='nearby'?'Dalam radius 5 km':'Laporan terbaru'}</strong><span>{filtered.length} laporan</span></div>{failed?<p>Data laporan belum dapat dimuat. Muat ulang halaman.</p>:!filtered.length?<p>Belum ada laporan dengan lokasi yang sesuai filter ini.</p>:filtered.map(r=><button type="button" key={r.id} aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)}><MapPin size={18}/><span><span className="map-report-meta"><small>{statusLabels[r.status]||r.status}</small><time dateTime={r.created_at} title={formatDate(r.created_at)}>{now===null?'…':relativeTime(r.created_at,now)}</time></span><strong>{r.title}</strong><span>{r.address}</span></span><ArrowUpRight size={16}/></button>)}</aside>

 </div><p className="section-footnote">Hanya laporan dengan koordinat valid yang ditampilkan. Lokasi perangkat digunakan saat kamu memilih “Sekitar saya” dan tidak disimpan.</p></section>;
}
