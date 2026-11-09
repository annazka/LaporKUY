'use client';
import {useId,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export function PasswordField({label='Kata sandi',name='password',autoComplete='current-password'}:{label?:string;name?:string;autoComplete?:string}){
 const [visible,setVisible]=useState(false),id=useId();
 return <div className="password-field"><label htmlFor={id}>{label}</label><div className="password-input-wrap"><input id={id} name={name} type={visible?'text':'password'} minLength={8} maxLength={128} required autoComplete={autoComplete} placeholder="Minimal 8 karakter"/><button type="button" aria-label={visible?`Sembunyikan ${label.toLowerCase()}`:`Tampilkan ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></div>;
}
