'use client';

import {useCallback,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUpRight,Camera,MapPin,ShieldCheck} from 'lucide-react';
import {PhotoAnalysis,type Analysis} from './photo-analysis';
import {ReportLocationPicker,type ReportLocation} from './report-location-picker';
import {validatePhoto} from '@/lib/photo-analysis-client.mjs';
import {validCoordinates} from '@/lib/rules.mjs';

import {REPORT_CATEGORIES} from '@/lib/report-categories.mjs';
type Draft={category:string;description:string;reportToken:string};
export function ReportForm(){
 const router=useRouter(),pending=useRef(false),activePhoto=useRef<File|null>(null),locationRequest=useRef(0),uploaded=useRef<{photo:File;token:string;path:string;receipt:string}|null>(null);
 const [analysisVersion,setAnalysisVersion]=useState(0),[busy,setBusy]=useState(false),[analysisBusy,setAnalysisBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<File|null>(null),[location,setLocation]=useState<ReportLocation|null>(null),[locationMessage,setLocationMessage]=useState(''),[stage,setStage]=useState('');
 const [draft,setDraft]=useState<Draft>({category:'',description:'',reportToken:''});
 function pick(next:File|null){
  const invalid=next?validatePhoto(next):null;if(invalid)next=null;
  activePhoto.current=next;setFile(next);setError(invalid||'');setStage('');setAnalysisBusy(Boolean(next));
  setDraft({category:'',description:'',reportToken:''});
 }
 const analyzed=useCallback((result:Analysis,photo:File)=>{
  if(activePhoto.current!==photo)return;
  if(!result.relevant||!REPORT_CATEGORIES.includes(result.category)||!result.report_token){setDraft({category:'',description:'',reportToken:''});return;}
  setDraft({category:result.category,description:result.summary.trim(),reportToken:result.report_token});
 },[]);
 const selectLocation=useCallback((point:ReportLocation)=>{locationRequest.current++;setLocation(point);setLocationMessage('Titik laporan dipilih. Periksa kembali alamat dan posisi pin.');},[]);
 function locate(){
  if(!navigator.geolocation){setLocationMessage('Perangkat tidak mendukung lokasi. Geser pin atau klik lokasi pada peta.');return;}
  const request=++locationRequest.current;setLocationMessage('Mencari lokasi...');
  navigator.geolocation.getCurrentPosition(pos=>{
   if(request!==locationRequest.current)return;
   const point={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
   if(!validCoordinates(point.latitude,point.longitude)){setLocationMessage('Lokasi perangkat berada di luar cakupan Jakarta. Pilih titik laporan pada peta.');return;}
   setLocation(point);setLocationMessage('Lokasi perangkat ditandai. Geser pin jika titik kerusakan berada di tempat lain.');
  },()=>{if(request===locationRequest.current)setLocationMessage('Lokasi perangkat belum dapat diakses. Geser pin atau klik titik laporan pada peta.');},{timeout:15000,enableHighAccuracy:true});
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending.current||analysisBusy)return;
  if(!file){setError('Tambahkan foto bukti terlebih dahulu.');return;}
  if(!draft.reportToken){setError('Tunggu analisis AI berhasil sebelum mengirim laporan. Jika gagal, tekan Coba Lagi.');return;}
  if(!location||!validCoordinates(location.latitude,location.longitude)){setError('Pilih titik lokasi laporan pada peta terlebih dahulu.');return;}
  const data=Object.fromEntries(new FormData(event.currentTarget).entries());pending.current=true;setBusy(true);setError('');
  try{
   let photo=uploaded.current;
   if(!photo||photo.photo!==file||photo.token!==draft.reportToken){
    setStage('Mengunggah foto...');const form=new FormData();form.set('file',file);form.set('report_token',draft.reportToken);
    const upload=await fetch('/api/upload',{method:'POST',body:form});const result=await upload.json();if(!upload.ok)throw Error(result.error||'Foto belum dapat diunggah.');
    photo={photo:file,token:draft.reportToken,path:result.path,receipt:result.report_receipt};uploaded.current=photo;
   }
   setStage('Memeriksa kecocokan foto dengan laporan terdekat...');const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,photo_path:photo.path,report_receipt:photo.receipt})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Laporan belum dapat disimpan.');
   router.push(`/reports/${result.id}?submitted=${result.duplicate?'duplicate':'new'}`);router.refresh();
  }catch(cause){setError((cause as Error).message);setStage('');}finally{pending.current=false;setBusy(false);}
 }
 return <form onSubmit={submit} className="report-form">
  <div className="panel form-stack"><div className="form-section-title"><span>01</span><div><h2>Ceritakan kondisinya</h2><p>Unggah foto untuk mengisi kategori dan deskripsi dengan AI.</p></div></div>
   <label className="upload-zone"><Camera size={30}/><strong>{file?file.name:'Tambahkan foto kerusakan'}</strong><span>JPG, PNG, atau WebP. Maksimal 4 MB.</span><input aria-label="Foto kerusakan" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} onChange={event=>{const selected=event.target.files?.[0]||null;pick(selected);if(selected&&validatePhoto(selected))event.target.value='';}}/></label>
   <PhotoAnalysis key={analysisVersion} file={file} onResult={analyzed} onBusyChange={setAnalysisBusy}/>
   <label>Judul laporan<input name="title" minLength={8} maxLength={140} required disabled={busy} placeholder="Contoh, jalan berlubang di depan halte"/></label>
   <label>Kategori<input name="category" value={draft.category} readOnly aria-readonly="true" placeholder="Ditentukan oleh AI dari foto"/></label>
   <label>Deskripsi kerusakan<textarea name="description" value={draft.description} readOnly aria-readonly="true" rows={4} placeholder="Deskripsi akan dibuat otomatis setelah analisis foto berhasil."/></label>
   <p className="help-text">Kategori dan deskripsi ditentukan oleh AI. Ganti foto jika hasilnya belum sesuai; operator tetap memverifikasi laporan.</p>
  </div>
  <div className="panel form-stack"><div className="form-section-title"><span>02</span><div><h2>Tandai lokasi</h2><p>Geser pin atau klik titik kerusakan pada peta Jakarta.</p></div></div>
   <button type="button" className="button secondary" disabled={busy} onClick={locate}><MapPin size={18}/>Gunakan lokasi saya</button>
   <ReportLocationPicker value={location} onChange={selectLocation} disabled={busy}/>
   <input type="hidden" name="latitude" value={location?.latitude.toFixed(6)||''}/><input type="hidden" name="longitude" value={location?.longitude.toFixed(6)||''}/>
   {locationMessage&&<p role="status" className="help-text">{locationMessage}</p>}
   <label>Alamat dan patokan<input name="address" minLength={8} maxLength={300} required disabled={busy} placeholder="Nama jalan, kelurahan, dan patokan terdekat"/></label>
   <div className="notice"><ShieldCheck size={20}/><p>Identitasmu disembunyikan dari publik. Hindari foto yang memperlihatkan wajah atau data pribadi.</p></div>
   <p className="help-text">Upvote hanya diberikan jika kategori sama, jarak maksimal 25 meter, dan AI menilai dengan keyakinan tinggi bahwa foto menunjukkan kerusakan yang sama. Jarak yang lebih dekat menambah bobot keyakinan.</p>
   {error&&<div className="form-error" role="alert"><p>{error}</p>{file&&draft.reportToken&&<button type="button" className="button secondary" disabled={busy} onClick={()=>{setDraft({category:'',description:'',reportToken:''});setError('');setAnalysisBusy(true);setAnalysisVersion(value=>value+1);}}>Coba analisis lagi</button>}</div>}{stage&&<p role="status">{stage}</p>}
   <button className="button full" disabled={busy||analysisBusy||!draft.reportToken}>{busy?'Mengirim...':analysisBusy?'Menunggu analisis foto...':'Kirim laporan'}<ArrowUpRight size={18}/></button>
  </div>
 </form>;
}
