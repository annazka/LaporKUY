import {PublicReportExplorer} from '@/components/public-report-explorer';
import {DataUnavailable} from '@/components/data-unavailable';
import {backend,configured} from '@/lib/backend';
import {loadPublicReports} from '@/lib/public-report-data.mjs';
import type {Report} from '@/lib/types';
export const dynamic='force-dynamic';
export const metadata={title:'Jelajahi laporan',description:'Peta laporan infrastruktur Jakarta, tren aduan warga, dan kategori kerusakan berdasarkan data laporan.'};
export default async function ProfileReports(){
 const asOf=new Date().toISOString();let list:Report[];
 try{if(!configured())throw Error('unavailable');list=await loadPublicReports(backend,asOf);}
 catch{return <div className="container page public-explorer"><h1>Jelajahi laporan</h1><DataUnavailable message="Data laporan belum dapat dimuat. Ringkasan dan peta belum tersedia."/></div>;}
 return <PublicReportExplorer reports={list} asOf={asOf}/>;
}
