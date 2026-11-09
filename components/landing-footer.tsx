import {Brand} from './ui';

const groups = [
  {title: 'Layanan', links: [['Laporan terbaru', '#laporan'], ['Peta laporan', '#peta'], ['Tukar poin', '#voucher']]},
  {title: 'Tentang', links: [['Tentang LaporKUY!', '#tentang-kita'], ['Dampak laporan', '#dampak']]},
  {title: 'Bantuan', links: [['Cara kerja', '#cara-kerja'], ['Pertanyaan umum', '#faq']]},
];

export function LandingFooter() {
  return <footer id="footer" className="landing-footer" aria-label="Footer LaporKUY!">
    <div className="container landing-footer-content">
      <div className="landing-footer-top">
        <div className="landing-footer-intro">
          <Brand/>
          <p>Laporkan kerusakan infrastruktur di Jakarta dan pantau penanganannya sampai selesai.</p>
          <a className="landing-footer-github" href="https://github.com/annazka/LaporinKUY" target="_blank" rel="noopener noreferrer" aria-label="Repositori LaporKUY! di GitHub (tab baru)"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.42-1.305.763-1.605-2.665-.3-5.467-1.334-5.467-5.93 0-1.31.467-2.38 1.236-3.22-.123-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.51 11.51 0 0 1 3.003-.404c1.02.005 2.045.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.655 1.652.242 2.873.12 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.625-5.48 5.922.43.37.823 1.102.823 2.222 0 1.606-.015 2.9-.015 3.293 0 .322.216.697.825.577C20.565 22.092 24 17.597 24 12.297c0-6.627-5.373-12-12-12"/></svg></a>
        </div>
        <nav className="landing-footer-nav" aria-label="Navigasi footer">
          {groups.map(group=><div key={group.title}><h2>{group.title}</h2><ul>{group.links.map(([label,href])=><li key={href}><a href={href}>{label}</a></li>)}</ul></div>)}
        </nav>
      </div>
      <div className="landing-footer-bottom"><p>Pelaporan infrastruktur Jakarta.</p><p>© {new Date().getFullYear()} LaporKUY!</p></div>
    </div>
    <div className="landing-footer-art" aria-hidden="true"/>
  </footer>;
}
