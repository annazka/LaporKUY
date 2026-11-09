export const accountLinks = [
 {href:'/dashboard',label:'Ringkasan',headerLabel:'Dashboard'},
 {href:'/dashboard/reports',label:'Laporan saya'},
 {href:'/profile/reports',label:'Jelajahi laporan'},
 {href:'/reports/new',label:'Buat laporan'},
 {href:'/profile/vouchers',label:'Voucher'},
 {href:'/profile',label:'Profil saya'},
];
export function headerLinks(signedIn, operator = false) {
 if (!signedIn) return [{href:'/#laporan',label:'Jelajahi laporan'}];
 const links = accountLinks.filter(link => ['/dashboard','/dashboard/reports','/profile/reports','/profile/vouchers'].includes(link.href))
  .map(link => ({href:link.href,label:link.headerLabel || link.label}));
 return operator ? [...links,{href:'/operator',label:'Operator'}] : links;
}
