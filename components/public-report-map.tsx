'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap} from 'leaflet';
import type {Report} from '@/lib/types';
import {statusLabels} from '@/lib/types';
import {validCoordinates} from '@/lib/rules.mjs';
import {watchMapTiles} from '@/lib/map-tiles.mjs';
export const publicStatusColors:Record<string,string>={submitted:'#c6cbd2',verified:'#93c5fd',scheduled:'#c4b5fd',in_progress:'#fcd34d',awaiting_confirmation:'#67e8f9',completed:'#86efac',rejected:'#fca5a5'};
export function PublicReportMap({reports,selected,onSelect}:{reports:Report[];selected:string|null;onSelect:(id:string)=>void}){
 const canvas=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);
 const [library,setLibrary]=useState<typeof import('leaflet')|null>(null),[attempt,setAttempt]=useState(0),[tileAttempt,setTileAttempt]=useState(0),[error,setError]=useState(''),[state,setState]=useState({loading:true,error:''});
 useEffect(()=>{
  let disposed=false;let observer:ResizeObserver|undefined;
  setError('');
  import('leaflet').then(L=>{if(disposed||!canvas.current)return;const instance=L.map(canvas.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([-6.2,106.83],11);map.current=instance;observer=new ResizeObserver(()=>instance.invalidateSize({animate:false}));observer.observe(canvas.current);setLibrary(L);}).catch(()=>{if(!disposed)setError('Peta belum dapat dibuka. Daftar laporan tetap tersedia.');});
  return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;};
 },[attempt]);
 useEffect(()=>{if(!library||!map.current)return;const tiles=library.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,className:'public-map-tiles',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});const stop=watchMapTiles(tiles,setState);tiles.addTo(map.current);return()=>{stop();tiles.remove();};},[library,tileAttempt]);
 useEffect(()=>{
  if(!library||!map.current)return;
  const group=library.layerGroup().addTo(map.current);const points=reports.filter(r=>validCoordinates(r.latitude,r.longitude));
  for(const r of points){const color=publicStatusColors[r.status]||'#ccc';const marker=library.marker([r.latitude,r.longitude],{title:`${r.title} — ${statusLabels[r.status]||r.status}`,alt:`Lihat ${r.title}`,icon:library.divIcon({className:'public-report-pin',html:`<span style="background:${color}"></span>`,iconSize:[24,24],iconAnchor:[12,12]})});marker.on('click',()=>onSelect(r.id)).addTo(group);}
  if(points.length)map.current.fitBounds(library.latLngBounds(points.map(r=>[r.latitude,r.longitude] as [number,number])),{padding:[36,36],maxZoom:14,animate:false});
  return()=>{group.remove();};
 },[library,reports,onSelect]);
 useEffect(()=>{const r=reports.find(r=>r.id===selected);if(r&&validCoordinates(r.latitude,r.longitude))map.current?.panTo([r.latitude,r.longitude],{animate:false});},[selected,reports,library]);
 return <div className="public-map-wrap"><div ref={canvas} className="public-map-canvas" role="region" aria-label="Peta semua laporan sesuai filter"/>
 {(error||state.error||state.loading)&&<div className="public-map-notice" role={error||state.error?'alert':'status'}><p>{error||state.error||'Memuat peta…'}</p>{(error||state.error)&&<button className="button secondary small" onClick={()=>error?setAttempt(n=>n+1):setTileAttempt(n=>n+1)}>Coba lagi</button>}</div>}
 </div>;
}
