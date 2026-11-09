'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {AuthLink} from './auth-modal';
import {PasswordField} from './password-field';
async function send(body:unknown){const r=await fetch('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Permintaan belum berhasil.');return d;}
export function ForgotPassword(){
 const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');const email=new FormData(e.currentTarget).get('email');try{await send({action:'request',email});setSent(true);}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}}
 return <section className="account-recovery"><h1>{sent?'Periksa email kamu.':'Lupa kata sandi?'}</h1><p>{sent?'Jika email terdaftar, tautan untuk membuat kata sandi baru akan dikirim ke alamat tersebut. Periksa juga folder spam.':'Masukkan email akun LaporKUY! untuk menerima tautan reset kata sandi.'}</p>{!sent&&<form className="form-stack" onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nama@email.com"/></label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="button full" disabled={busy}>{busy?'Mengirim…':'Kirim tautan reset'}</button></form>}{sent&&<button className="auth-text-button" onClick={()=>setSent(false)}>Gunakan email lain</button>}<AuthLink className="account-recovery-back">Kembali ke masuk</AuthLink></section>;
}
export function PasswordRecovery(){
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const reload=()=>setRevision(value=>value+1);window.addEventListener('hashchange',reload);window.addEventListener('popstate',reload);return()=>{window.removeEventListener('hashchange',reload);window.removeEventListener('popstate',reload);};},[]);
 return <RecoveryForm key={revision}/>;
}
function RecoveryForm(){
 const [state,setState]=useState<'loading'|'ready'|'error'|'success'>('loading'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const flow=useRef('');
 const init=useRef(false),credentials=useRef<Record<string,string>|null>(null),automatic=useRef<Promise<{flow:string}>|null>(null),pending=useRef(false);
 useEffect(()=>{
  let active=true;
  if(!init.current){init.current=true;const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);history.replaceState(history.state,'','/auth/reset');
   const type=hash.get('type')||query.get('type')||(location.pathname==='/auth/reset'?'recovery':null);
   if(type==='recovery'&&!hash.has('error')&&!query.has('error')&&!hash.has('error_code')&&!query.has('error_code')){
    const token=query.get('token_hash'),access=hash.get('access_token');credentials.current=token?{token_hash:token}:access?{access_token:access}:null;
   }
   if(credentials.current)automatic.current=send({action:'exchange',...credentials.current});
   else if(type==='recovery'&&!hash.has('error')&&!query.has('error')&&!hash.has('error_code')&&!query.has('error_code'))automatic.current=send({action:'resume'});
   else{setState('error');setError('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.');}
  }
  automatic.current?.then(result=>{if(active){flow.current=result.flow;credentials.current=null;setState('ready');}}).catch(e=>{if(active){setState('error');setError(e.message);}});
  return()=>{active=false;};
 },[]);
 async function retry(){if(pending.current||!credentials.current)return;pending.current=true;setBusy(true);try{const result=await send({action:'exchange',...credentials.current});flow.current=result.flow;credentials.current=null;setState('ready');setError('');}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(pending.current)return;const data=new FormData(e.currentTarget);if(data.get('password')!==data.get('confirmation')){setError('Kedua kata sandi harus sama.');return;}pending.current=true;setBusy(true);setError('');try{await send({action:'update',password:data.get('password'),flow:flow.current});setState('success');}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}}
 return <section className="account-recovery" aria-busy={state==='loading'||busy}><h1>{state==='success'?'Kata sandi diperbarui.':state==='loading'?'Memeriksa tautan…':state==='error'?'Tautan belum dapat digunakan.':'Buat kata sandi baru.'}</h1><p>{state==='success'?'Masuk ke LaporKUY! menggunakan kata sandi barumu.':state==='ready'?'Gunakan minimal 8 karakter dan kata sandi yang belum pernah kamu pakai.':state==='loading'?'Tunggu sebentar saat kami memeriksa tautan reset.':error}</p>{state==='ready'&&<form className="form-stack" onSubmit={submit}><PasswordField label="Kata sandi baru" autoComplete="new-password"/><PasswordField label="Ulangi kata sandi" name="confirmation" autoComplete="new-password"/>{error&&<p role="alert" className="form-error">{error}</p>}<button className="button full" disabled={busy}>{busy?'Menyimpan…':'Simpan kata sandi'}</button></form>}{state==='error'&&<>{credentials.current&&<button className="button secondary" disabled={busy} onClick={retry}>Coba lagi</button>}<Link className="button full" href="/auth/forgot">Minta tautan baru</Link></>}{state==='success'&&<AuthLink className="button full">Masuk dengan kata sandi baru</AuthLink>}</section>;
}
