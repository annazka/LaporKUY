'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {headerLinks} from '@/lib/account-navigation.mjs';
export function MainNav({signedIn,operator}:{signedIn:boolean;operator:boolean}) {
 const path=usePathname();
 return <nav aria-label="Navigasi utama">{headerLinks(signedIn,operator).map(({href,label})=>
  <Link key={href} href={href} aria-current={path===href||(href==='/dashboard'&&(/^\/dashboard(?:\/|$)/.test(path)||path==='/reports/new'||path==='/profile'))?'page':undefined}>{label}</Link>
 )}</nav>;
}
