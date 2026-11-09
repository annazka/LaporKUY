export const accountLinks = [
 {href:'/dashboard',label:'Ringkasan',headerLabel:'Dashboard'},
 {href:'/dashboard/reports',label:'Laporan saya'},
 {href:'/reports/new',label:'Buat laporan'},
 {href:'/profile',label:'Profil saya'},
];
export function headerLinks(_signedIn, _operator = false) {
 return [
  {href:'/dashboard',label:'Dashboard'},
  {href:'/profile/reports',label:'Jelajahi laporan'},
  {href:'/profile/vouchers',label:'Voucher'},
 ];
}
