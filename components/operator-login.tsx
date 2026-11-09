'use client';
import Link from 'next/link';
import Image from 'next/image';
import {AuthForm} from './forms';
import {Logout} from './widgets';
export function OperatorLogin({signedIn}:{signedIn:boolean}){return <div className="admin-app"><div className="admin-login"><Link className="brand" href="/"><Image className="brand-mark" src="/media/brand/obelisk.png" alt="" width={36} height={38}/>LaporKUY!</Link><h1>Masuk operator</h1><p>Masuk dengan username admin atau email akun operator.</p>{signedIn&&<div className="admin-notice">Akun saat ini tidak memiliki akses operator. <Logout/></div>}<AuthForm operatorLogin next="/operator" allowRegister={false} onModeChange={()=>{}}/><Link href="https://laporkuy.online/">Kembali ke LaporKUY!</Link></div></div>;}
