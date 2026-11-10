import {NextResponse} from 'next/server';
import {viewer} from '@/lib/backend';
import {addressQuery,createAddressSearch} from '@/lib/address-search.mjs';
export const maxDuration=60;
const search=createAddressSearch();
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 if(!await viewer())return NextResponse.json({error:'Silakan masuk untuk mencari alamat.'},{status:401,headers});
 const query=addressQuery(new URL(request.url).searchParams.get('q'));
 if(!query)return NextResponse.json({error:'Masukkan kata pencarian alamat antara 3 dan 300 karakter.'},{status:400,headers});
 try{return NextResponse.json({results:await search(query)},{headers});}
 catch(e){if((e as {status?:number})?.status===400)return NextResponse.json({error:(e as Error).message},{status:400,headers});const limited=(e as {status?:number})?.status===429;return NextResponse.json({error:limited?'Pencarian alamat sedang sibuk. Tunggu sebentar lalu coba lagi.':'Alamat belum dapat dicari. Coba lagi atau pilih titik langsung pada peta.'},{status:limited?429:502,headers:{...headers,...(limited?{'Retry-After':'1'}:{})}});}
}
