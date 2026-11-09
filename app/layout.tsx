import {viewer} from '@/lib/backend';
import {cookies,headers} from 'next/headers';
import {SiteFrame} from '@/components/site-frame';
import {LandingFooter} from '@/components/landing-footer';
import type {Metadata} from 'next';import './globals.css';import './night-theme.css';import './refresh.css';import './landing-header.css';import './auth-modal.css';import {AuthProvider} from '@/components/auth-modal';import {Header,Footer} from '@/components/ui';import {SessionRefresh} from '@/components/session-refresh';import {VisualEffects} from '@/components/visual-effects';
import './time-palette.css';
import './photo-analysis.css';
import './report-location.css';
import './landing-reports.css';
import 'leaflet/dist/leaflet.css';
import './landing-explore.css';
import './landing-editorial.css';
import './landing-video.css';
import './landing-footer.css';
export const metadata:Metadata={title:{default:'LaporKUY! Suara warga, aksi nyata.',template:'%s | LaporKUY!'},description:'Laporkan kerusakan infrastruktur Jakarta, pantau progres perbaikan, dan kumpulkan poin dari laporan yang tuntas.'};
export default async function Layout({children}:{children:React.ReactNode}){const user=await viewer();const canRefresh=Boolean((await cookies()).get('lk_refresh')?.value);const adminDomain=(await headers()).get('x-laporkuy-admin-domain')==='1';return <html lang="id"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></head><body><AuthProvider signedIn={Boolean(user)}><a className="skip-link" href="#main">Lewati ke konten</a><SiteFrame header={<Header/>} footer={<Footer/>} landingFooter={<LandingFooter/>} adminDomain={adminDomain}>{children}</SiteFrame><SessionRefresh enabled={canRefresh} signedIn={Boolean(user)}/><VisualEffects/></AuthProvider></body></html>;}
