'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export function SiteFrame({children,header,footer,landingFooter,adminDomain}:{children:ReactNode;header:ReactNode;footer:ReactNode;landingFooter:ReactNode;adminDomain:boolean}){
 const path=usePathname(),admin=adminDomain||path==='/operator'||path.startsWith('/operator/');
 return <>{!admin&&header}<main id="main">{children}</main>{!admin&&(path==='/'?landingFooter:footer)}</>;
}
