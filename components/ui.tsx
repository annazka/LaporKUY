import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  MapPin,
  Clock3,
  Layers,
  MoveUpRight,
  CheckCheck,
  ArrowRight,
  Construction,
  Coins,
} from "lucide-react";
import { viewer, pointBalance } from "@/lib/backend";
import {
  formatDate,
  statusLabels,
  priorityLabels,
  type Report,
} from "@/lib/types";
import { isOverdue, missingDailyUpdate } from "@/lib/rules.mjs";
import { Logout } from "./widgets";
import { SiteHeader } from "./site-header";
import { AuthLink } from "./auth-modal";
export function Brand() {
  return (
    <a href="/" className="brand">
      <Image className="brand-mark" src="/media/brand/obelisk.png" alt="" width={36} height={38} priority />
      Lapor<span>KUY!</span>
    </a>
  );
}
export async function Header() {
  const u = await viewer();
  const balance = u ? await pointBalance() : null;
  return (
    <SiteHeader
      brand={<Brand />}
      actions={
        u ? (
          <>
            <Link className="nav-point-balance" href="/profile/vouchers" aria-label={balance === null ? "Saldo poin belum dapat dimuat. Buka voucher" : `${balance.toLocaleString("id-ID")} poin. Buka voucher`} title="Poin simulasi">
              <Coins size={17} aria-hidden="true" />
              <span>{balance === null ? "Poin —" : `${balance.toLocaleString("id-ID")} poin`}</span>
            </Link>
            <Link className="profile-pill" href="/profile">
              <span>{u.name.slice(0, 1).toUpperCase()}</span>
              <b>{u.name}</b>
            </Link>
            <Logout />
          </>
        ) : (
          <>
            <AuthLink className="login-link">Masuk</AuthLink>
            <AuthLink mode="register" className="button small">
              Gabung sekarang <ArrowUpRight size={16} />
            </AuthLink>
          </>
        )
      }
    >
      <nav aria-label="Navigasi utama">
        {u && <Link href="/dashboard">Dashboard</Link>}
        <Link href="/#laporan">Jelajahi laporan</Link>
        {u && <Link href="/profile/vouchers">Voucher</Link>}
        {u?.role === "operator" && <Link href="/operator">Operator</Link>}
      </nav>
    </SiteHeader>
  );
}
export function Footer() {
  return (
    <footer>
      <Brand />
      <p>Pelaporan jalan rusak di Jakarta.</p>
      <span>Prototipe MIA 2026 · Jakarta</span>
    </footer>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow">
      <span />
      {children}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Status({ report }: { report: Report }) {
  const overdue = isOverdue(report);
  return (
    <span
      className={`badge ${overdue ? "danger" : report.status === "completed" ? "success" : report.status === "submitted" ? "neutral" : "info"}`}
    >
      {overdue ? "Terlambat" : statusLabels[report.status]}
    </span>
  );
}
export function ReportCard({ report: r }: { report: Report }) {
  return (
    <Link href={`/reports/${r.id}`} className="report-card">
      <div className="report-top">
        <span className="category-icon">
          <Construction size={20} />
        </span>
        <Status report={r} />
      </div>
      <span className="small-label">
        {r.category} · #{r.id.slice(0, 6).toUpperCase()}
      </span>
      <h3>{r.title}</h3>
      <p className="address">
        <MapPin size={14} />
        {r.address}
      </p>
      <div className="progress-track">
        <span style={{ width: `${r.progress}%` }} />
      </div>
      <div className="report-meta">
        <span>{r.progress}% progres</span>
        <span>{r.support_count + 1} pelapor</span>
      </div>
      <div className="report-bottom">
        <span>
          <Clock3 size={14} />
          {r.target_date
            ? `Target ${formatDate(r.target_date)}`
            : "Menunggu estimasi"}
        </span>
        <ArrowUpRight size={18} />
      </div>
    </Link>
  );
}
export function Empty({
  title = "Belum ada laporan",
  text = "Jadilah warga pertama yang melaporkan kerusakan di sekitarmu.",
  action = true,
}: {
  title?: string;
  text?: string;
  action?: boolean;
}) {
  return (
    <div className="empty">
      <span>
        <Layers size={30} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <Link className="button" href="/reports/new">
          Buat laporan <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: string | number; note: string }[];
}) {
  return (
    <div className="stats-grid">
      {items.map((s, i) => (
        <div className="stat-card" key={s.label}>
          <span className="stat-number">0{i + 1}</span>
          <p>{s.label}</p>
          <strong>{s.value}</strong>
          <small>{s.note}</small>
        </div>
      ))}
    </div>
  );
}
export function DailyFlag({ report }: { report: Report }) {
  return missingDailyUpdate(report) ? (
    <span className="badge warning">Belum ada pembaruan hari ini</span>
  ) : null;
}
export function DetailFacts({ report: r }: { report: Report }) {
  return (
    <div className="facts">
      <div>
        <span>Prioritas penanganan</span>
        <b>{priorityLabels[r.priority]}</b>
      </div>
      <div>
        <span>Mulai perbaikan</span>
        <b>{formatDate(r.start_date)}</b>
      </div>
      <div>
        <span>Target selesai</span>
        <b>{formatDate(r.target_date)}</b>
      </div>
      <div>
        <span>Jumlah laporan warga</span>
        <b>
          {r.support_count + 1} pelapor · {r.support_count} upvote
        </b>
      </div>
      <div>
        <span>Terakhir diperbarui</span>
        <b>
          {r.last_update_at
            ? formatDate(r.last_update_at)
            : "Belum ada pembaruan"}
        </b>
      </div>
    </div>
  );
}
