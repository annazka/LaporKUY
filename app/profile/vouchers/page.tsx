import { LandingVouchers } from '@/components/landing-vouchers';
import { requireViewer, accessToken, backend, pointBalance } from '@/lib/backend';
import type { Voucher } from '@/lib/types';
export const metadata = { title: 'Voucher' };
export default async function Vouchers() {
 const user = await requireViewer(false, '/profile/vouchers'), token = await accessToken();
 const [offers, balance, history] = await Promise.allSettled([
  backend('/rest/v1/vouchers?select=*&order=cost.asc'),
  pointBalance(),
  backend(`/rest/v1/redemptions?select=id,code,voucher_id,created_at&user_id=eq.${user.id}&order=created_at.desc`, {}, token),
 ]);
 const points = balance.status === 'fulfilled' ? balance.value : null;
 return <div className="container page voucher-page"><LandingVouchers catalog vouchers={offers.status === 'fulfilled' ? offers.value as Voucher[] : []} balance={points ?? 0} signedIn failed={offers.status === 'rejected'} accountFailed={points === null || history.status === 'rejected'} redemptions={history.status === 'fulfilled' ? history.value : []}/></div>;
}
