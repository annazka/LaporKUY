'use client';

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode,type MouseEvent} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {MapPin,X,ShieldCheck} from 'lucide-react';
import {AuthForm} from './forms';
import {safeNext} from '@/lib/rules.mjs';

type Mode='login'|'register';
type AuthState={mode:Mode;next:string};
const AuthContext=createContext<{open:(mode:Mode,next?:string)=>void;signedIn:boolean}|null>(null);

export function AuthProvider({children,signedIn}:{children:ReactNode;signedIn:boolean}){
 const router=useRouter();
 const [auth,setAuth]=useState<AuthState|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const pathname=usePathname();
 const open=useCallback((mode:Mode,next='/dashboard')=>{
  if(signedIn){router.push(safeNext(next));return;}
  setAuth({mode,next:safeNext(next)});
 },[signedIn,router]);
 const close=useCallback(()=>{
  setAuth(null);
  const url=new URL(window.location.href);
  if(url.searchParams.has('auth')){
   url.searchParams.delete('auth');url.searchParams.delete('next');
   window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  }
 },[]);
 useEffect(()=>{if(pathname!=='/')setAuth(null);},[pathname]);
 const visible=auth!==null;
 useEffect(()=>{
  if(!visible)return;
  const element=dialog.current;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  element?.showModal();
  const trapFocus=(event:KeyboardEvent)=>{
   if(event.key!=='Tab'||!element)return;
   const items=Array.from(element.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(item=>item.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];
   if(!first)return;
   if(!element.contains(document.activeElement)||(event.shiftKey?document.activeElement===first:document.activeElement===last)){
    event.preventDefault();(event.shiftKey?last:first).focus();
   }
  };
  document.addEventListener('keydown',trapFocus);
  return()=>{document.removeEventListener('keydown',trapFocus);element?.close();document.body.style.overflow=overflow;};
 },[visible]);
 useEffect(()=>{if(auth)dialog.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});},[auth?.mode,visible]);
 return <AuthContext.Provider value={{open,signedIn}}>{children}
  <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-title" aria-describedby="auth-description" onCancel={event=>{event.preventDefault();close();}} onClose={close} onClick={event=>{
   if(event.target!==event.currentTarget)return;
   const box=event.currentTarget.getBoundingClientRect();
   if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();
  }}>
   {auth&&<div className="auth-dialog-content">
    <button type="button" className="auth-dialog-close" aria-label="Tutup popup" onClick={close}><X size={20}/></button>
    <span className="auth-dialog-symbol" aria-hidden="true"><MapPin size={26}/></span>
    <div className="auth-dialog-intro">
     <h2 id="auth-title">{auth.mode==='login'?'Masuk ke LaporKUY!':'Daftar LaporKUY!'}</h2>
     <p id="auth-description">{auth.mode==='login'?'Masuk untuk melapor, memantau, dan melihat kontribusimu.':'Buat akun dan ikut menjaga Jakarta, satu laporan setiap waktu.'}</p>
    </div>
    <div className="auth-mode-switch" role="group" aria-label="Pilih masuk atau daftar">
     <button type="button" aria-pressed={auth.mode==='login'} onClick={()=>open('login',auth.next)}>Masuk</button>
     <button type="button" aria-pressed={auth.mode==='register'} onClick={()=>open('register',auth.next)}>Daftar</button>
    </div>
    <AuthForm key={auth.mode} register={auth.mode==='register'} next={auth.next} onModeChange={mode=>open(mode,auth.next)} onSuccess={close}/>
    <p className="auth-dialog-trust"><ShieldCheck size={14}/> Identitasmu tetap terlindungi.</p>
   </div>}
  </dialog>
 </AuthContext.Provider>;
}

export function AuthLink({mode='login',next='/dashboard',className,children}:{mode?:Mode;next?:string;className?:string;children:ReactNode}){
 const auth=useContext(AuthContext),pathname=usePathname();
 const open=auth?.open;
 const href=auth?.signedIn?safeNext(next):`/?auth=${mode}&next=${encodeURIComponent(safeNext(next))}`;
 function click(event:MouseEvent<HTMLAnchorElement>){
  if(auth?.signedIn||pathname!=='/'||!open||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();open(mode,next);
 }
 return <a href={href} className={className} onClick={click}>{children}</a>;
}

export function AuthEntry({mode,next}:{mode:Mode;next:string}){
 const open=useContext(AuthContext)?.open;
 useEffect(()=>{open?.(mode,next);},[open,mode,next]);
 return null;
}
