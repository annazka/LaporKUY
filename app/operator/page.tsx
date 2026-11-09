import {redirect} from 'next/navigation';
import {backend,viewer,accessToken,reports} from '@/lib/backend';
import type {Update,Voucher} from '@/lib/types';
import {OperatorDashboard,type AdminEvent,type Redemption} from '@/components/operator-dashboard';

export const dynamic='force-dynamic';
export const metadata={title:'Meja kendali operator',robots:{index:false,follow:false}};
export default async function Operator(){
 const user=await viewer();if(!user||user.role!=='operator')redirect('/operator/login');
 const token=await accessToken();
 const [list,history,offers,admin]=await Promise.allSettled([
  reports(),backend('/rest/v1/report_updates?select=*&order=created_at.desc&limit=500',{},token),
  backend('/rest/v1/vouchers?select=*&order=cost.asc',{},token),
  backend('/rest/v1/rpc/operator_admin_overview',{method:'POST',body:'{}'},token),
 ]);
 const failures:string[]=[];
 if(list.status==='rejected')failures.push('Laporan belum dapat dimuat.');
 if(history.status==='rejected')failures.push('Riwayat laporan belum dapat dimuat.');
 if(offers.status==='rejected')failures.push('Katalog voucher belum dapat dimuat.');
 const snapshot=admin.status==='fulfilled'?admin.value:null;
 const reason=admin.status==='rejected'?String(admin.reason?.message||''):'';
 const voucherNotice=/operator_admin_overview|schema cache|function.*not found|could not find.*function/i.test(reason)?'Katalog tersedia. Perubahan voucher belum diaktifkan.':'Pengelolaan voucher belum dapat dimuat. Coba muat ulang.';
 const voucherReady=Boolean(snapshot&&Array.isArray(snapshot.redemptions)&&Array.isArray(snapshot.events));
 return <OperatorDashboard asOf={new Date().toISOString()} user={user} reports={list.status==='fulfilled'?list.value:[]} updates={history.status==='fulfilled'?history.value as Update[]:[]} vouchers={offers.status==='fulfilled'?offers.value as Voucher[]:[]} redemptions={voucherReady?snapshot.redemptions as Redemption[]:[]} voucherEvents={voucherReady?snapshot.events as AdminEvent[]:[]} voucherReady={voucherReady} voucherNotice={voucherNotice} failures={failures}/>;
}
