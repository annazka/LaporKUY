import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {backend} from '@/lib/backend';
import {PASSWORD_RESET_URL} from '@/lib/password-recovery.mjs';
const cookie='lk_password_reset';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status,headers});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Permintaan tidak valid.',403);
 try{
  const body=await request.json(),jar=await cookies();
  if(body.action==='request'){
   if(typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email.trim()))return fail('Masukkan alamat email yang valid.');
   try{await backend(`/auth/v1/recover?redirect_to=${encodeURIComponent(PASSWORD_RESET_URL)}`,{method:'POST',body:JSON.stringify({email:body.email.trim()})});}
   catch{return fail('Email reset belum dapat dikirim. Tunggu beberapa saat lalu coba lagi.',503);}
   return NextResponse.json({ok:true},{headers});
  }
  if(body.action==='resume'){
   const reset=JSON.parse(jar.get(cookie)?.value||'null'),token=reset?.token;
   if(!token)return fail('Sesi reset berakhir. Minta tautan baru.',401);
   const user=await backend('/auth/v1/user',{},token);
   if(!user?.id)return fail('Sesi reset tidak berlaku. Minta tautan baru.',401);
   return NextResponse.json({ok:true,flow:reset.flow},{headers});
  }
  if(body.action==='exchange'){
   let token:string;
   if(typeof body.token_hash==='string'&&/^[a-zA-Z0-9_-]{16,512}$/.test(body.token_hash)&&!body.access_token){
    const result=await backend('/auth/v1/verify',{method:'POST',body:JSON.stringify({type:'recovery',token_hash:body.token_hash})});
    if(!result?.user?.id||typeof result.access_token!=='string')return fail('Tautan reset tidak berlaku. Minta tautan baru.');
    token=result.access_token;
   }else if(typeof body.access_token==='string'&&body.access_token.length>20&&body.access_token.length<=8192&&!/\s/.test(body.access_token)&&!body.token_hash){
    const user=await backend('/auth/v1/user',{},body.access_token);
    if(!user?.id)return fail('Tautan reset tidak berlaku. Minta tautan baru.');
    token=body.access_token;
   }else return fail('Tautan reset tidak valid.');
   const flow=crypto.randomUUID();
   jar.set(cookie,JSON.stringify({token,flow}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/auth/password',maxAge:600});
   return NextResponse.json({ok:true,flow},{headers});
  }
  if(body.action==='update'){
   const reset=JSON.parse(jar.get(cookie)?.value||'null'),token=reset?.token;
   if(!token)return fail('Sesi reset berakhir. Minta tautan baru.',401);
   if(typeof body.password!=='string'||body.password.length<8||body.password.length>128)return fail('Gunakan kata sandi antara 8 dan 128 karakter.');
   if(typeof body.flow!=='string'||body.flow!==reset.flow)return fail('Tautan reset lain telah dibuka. Muat ulang halaman ini sebelum menyimpan.',409);
   try{await backend('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:body.password})},token);}
   catch{return fail('Kata sandi belum dapat disimpan. Gunakan kata sandi baru yang berbeda, atau minta tautan reset baru.');}
   jar.set(cookie,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/auth/password',maxAge:0});
   return NextResponse.json({ok:true},{headers});
  }
  return fail('Aksi tidak valid.');
 }catch{return fail('Tautan tidak berlaku atau koneksi terganggu. Coba lagi atau minta tautan baru.');}
}
