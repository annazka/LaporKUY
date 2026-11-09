'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {CameraOff} from 'lucide-react';
import {reportPhotoAlt,reportPhotoUrl,usesRepairPhoto} from '@/lib/report-photo.mjs';
type PhotoReport={id:string;title:string;status:string;last_update_at?:string|null};
type Props={report:PhotoReport;width?:number;height?:number;style?:CSSProperties;loading?:'lazy'|'eager'};
export function ReportImage(props:Props){const source=reportPhotoUrl(props.report);return <ImageContent key={source} {...props} source={source}/>;}
function ImageContent({report,source,width,height,style,loading='lazy'}:Props&{source:string}){
 const [failed,setFailed]=useState(false);
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{if(image.current?.complete&&image.current.naturalWidth===0)setFailed(true);},[source]);
 if(failed)return <div className="report-photo-unavailable" style={style}><CameraOff size={26} aria-hidden="true"/><span>{usesRepairPhoto(report.status)?'Foto hasil perbaikan belum tersedia':'Foto belum tersedia'}</span></div>;
 return <img ref={image} src={source} alt={reportPhotoAlt(report)} width={width} height={height} style={style} loading={loading} decoding="async" onError={()=>setFailed(true)}/>;
}
