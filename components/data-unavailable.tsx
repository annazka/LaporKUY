"use client";
import {useRouter} from 'next/navigation';
export function DataUnavailable({message}:{message:string}) {
 const router=useRouter();
 return <div className="notice" role="alert"><p>{message}</p><button type="button" className="button secondary small" onClick={()=>router.refresh()}>Coba lagi</button></div>;
}
