'use client';

import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap,Marker,TileLayer} from 'leaflet';
import {validCoordinates} from '@/lib/rules.mjs';
export type ReportLocation={latitude:number;longitude:number};
const center:ReportLocation={latitude:-6.2088,longitude:106.8456};
export function ReportLocationPicker(props:{value:ReportLocation|null;onChange:(point:ReportLocation)=>void;disabled?:boolean}){
 const [attempt,setAttempt]=useState(0);
 return <LocationCanvas key={attempt} {...props} onRetry={()=>setAttempt(value=>value+1)}/>;
}
function LocationCanvas({value,onChange,disabled=false,onRetry}:{value:ReportLocation|null;onChange:(point:ReportLocation)=>void;disabled?:boolean;onRetry:()=>void}){
 const canvas=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<Marker|null>(null);
 const current=useRef({value,onChange,disabled});
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selectionError,setSelectionError]=useState('');
 useEffect(()=>{current.current={value,onChange,disabled};},[value,onChange,disabled]);
 useEffect(()=>{
  let disposed=false,observer:ResizeObserver|undefined,tiles:TileLayer|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  import('leaflet').then(L=>{
   if(disposed||!canvas.current)return;
   const point=current.current.value||center;
   const instance=L.map(canvas.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,maxBounds:[[-6.5,106.65],[-6.05,107]],maxBoundsViscosity:1}).setView([point.latitude,point.longitude],13);
   map.current=instance;
   const pin=L.marker([point.latitude,point.longitude],{draggable:!current.current.disabled,title:'Geser pin lokasi laporan',alt:'Pin lokasi laporan',icon:L.divIcon({className:'report-location-pin',html:'<span aria-hidden="true"></span>',iconSize:[32,42],iconAnchor:[16,40]})}).addTo(instance);
   marker.current=pin;
   const choose=(lat:number,lng:number)=>{
    if(current.current.disabled)return;
    if(!validCoordinates(lat,lng)){const previous=current.current.value||center;pin.setLatLng([previous.latitude,previous.longitude]);setSelectionError('Pilih titik laporan di wilayah Jakarta daratan.');return;}
    pin.setLatLng([lat,lng]);setSelectionError('');current.current.onChange({latitude:lat,longitude:lng});
   };
   instance.on('click',event=>choose(event.latlng.lat,event.latlng.lng));
   pin.on('dragend',()=>{const point=pin.getLatLng();choose(point.lat,point.lng);});
   tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
   let failed=false;
   tiles.on('tileerror',()=>{if(disposed)return;failed=true;setLoading(false);setError('Latar peta belum dapat dimuat. Coba muat ulang peta.');});
   tiles.on('load',()=>{if(disposed)return;clearTimeout(timer);setLoading(false);if(!failed)setError('');});
   timer=setTimeout(()=>{if(!disposed){setLoading(false);setError('Peta terlalu lama dimuat. Coba muat ulang peta.');}},12000);
   tiles.addTo(instance);
   observer=new ResizeObserver(()=>{if(!disposed)instance.invalidateSize({animate:false});});observer.observe(canvas.current);
   setReady(true);
  }).catch(()=>{if(!disposed){setLoading(false);setError('Peta belum dapat dibuka. Coba muat ulang peta.');}});
  return()=>{disposed=true;clearTimeout(timer);observer?.disconnect();if(map.current){map.current.stop();map.current.remove();map.current=null;}tiles?.off();marker.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current,pin=marker.current;if(!instance||!pin||!value)return;
  pin.setLatLng([value.latitude,value.longitude]);
  if(!instance.getBounds().contains([value.latitude,value.longitude]))instance.panTo([value.latitude,value.longitude],{animate:false});
 },[value]);
 useEffect(()=>{if(disabled)marker.current?.dragging?.disable();else marker.current?.dragging?.enable();},[disabled,ready]);
 function chooseCenter(){const point=map.current?.getCenter();if(!point||disabled)return;if(!validCoordinates(point.lat,point.lng)){setSelectionError('Pilih titik laporan di wilayah Jakarta daratan.');return;}onChange({latitude:point.lat,longitude:point.lng});setSelectionError('');}
 return <section className="report-location-picker" aria-label="Pilih titik laporan pada peta"><div className="report-location-map-wrap"><div ref={canvas} className="report-location-map" aria-label="Peta pemilihan lokasi laporan"/>{loading&&<p className="report-location-loading" role="status">Memuat peta...</p>}</div>
  <button className="button secondary" type="button" disabled={!ready||disabled} onClick={chooseCenter}>Gunakan titik tengah peta</button>
  <p className="help-text">{value?'Titik laporan sudah dipilih. Kamu masih bisa menggeser pin.':'Pilih titik kerusakan sebelum mengirim laporan. Kamu juga bisa menggeser peta dengan tombol panah lalu memilih titik tengahnya.'}</p>
  {selectionError&&<p className="form-error" role="alert">{selectionError}</p>}
  {error&&<div className="form-error" role="alert"><p>{error}</p><button type="button" className="button secondary" disabled={disabled} onClick={onRetry}>Muat ulang peta</button></div>}
 </section>;
}
