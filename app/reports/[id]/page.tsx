import {DataUnavailable} from "@/components/data-unavailable";
import {ReportImage} from '@/components/report-image';
import {usesRepairPhoto} from '@/lib/report-photo.mjs';
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, ArrowUpRight } from "lucide-react";
import { backend, viewer, accessToken, photoUrl } from "@/lib/backend";
import { Status, DailyFlag, DetailFacts } from "@/components/ui";
import { OperatorForm, ConfirmRepair } from "@/components/forms";
import { formatDate, type Report, type Update } from "@/lib/types";
import { isOverdue } from "@/lib/rules.mjs";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const [rows, u, query] = await Promise.all([
    backend(`/rest/v1/reports?id=eq.${id}&select=*`).catch(() => null),
    viewer(),
    searchParams,
  ]);
  if (rows === null) return <div className="container page"><DataUnavailable message="Detail laporan belum dapat dimuat."/></div>;
  const r: Report = rows[0];
  if (!r) notFound();
  const updates: Update[] | null = await backend(
    `/rest/v1/report_updates?report_id=eq.${id}&order=created_at.desc`,
  ).catch(() => null);
  const token = await accessToken();
  const own = u
    ? await backend(
        `/rest/v1/submissions?report_id=eq.${id}&user_id=eq.${u.id}&select=is_primary`,
        {},
        token,
      ).catch(() => null)
    : [];
  return (
    <div className="container page">
      <Link className="back-link" href="/dashboard/reports">
        <ArrowLeft size={16} />
        Semua laporan
      </Link>
      {query.submitted && (
        <div className="notice success-notice">
          {query.submitted === "duplicate"
            ? "Laporanmu tergabung pada kasus ini. Satu akun dihitung satu kali sebagai pelapor."
            : "Laporan berhasil dikirim. Operator akan memverifikasi bukti dan lokasinya."}
        </div>
      )}
      <div className="detail-title">
        <div>
          <div className="status-row">
            <Status report={r} />
            <DailyFlag report={r} />
          </div>
          <h1>{r.title}</h1>
          <p>
            <MapPin size={16} />
            {r.address}
          </p>
        </div>
        <span className="small-label">#{r.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel">
            <div className="report-photo">
              <ReportImage report={r} loading="eager"/>
              <span className="photo-label">{usesRepairPhoto(r.status)?'FOTO HASIL PERBAIKAN':'FOTO LAPORAN AWAL'}</span>
            </div>
            <h2>Tentang laporan ini</h2>
            <p className="description">{r.description}</p>
            <div className="report-meta">
              <span>{r.category}</span>
              <span>Dilaporkan {formatDate(r.created_at)}</span>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Riwayat progres</h2>
              <span className="small-label">TERBUKA & TERCATAT</span>
            </div>
            {updates === null ? <DataUnavailable message="Riwayat progres belum dapat dimuat."/> : updates.length === 0 ? <p>Belum ada riwayat progres.</p> : updates.map((update) => (
              <article className="timeline-entry" key={update.id}>
                <span className="timeline-dot" />
                <small>
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(update.created_at))}{" "}
                  WIB
                </small>
                <h3>
                  {(
                    {
                      submitted: "Laporan diterima",
                      verify: "Laporan terverifikasi",
                      progress: "Pembaruan harian",
                      reschedule: "Jadwal diperbarui",
                      finish: "Perbaikan selesai",
                      completed: "Hasil dikonfirmasi",
                      reopened: "Pemeriksaan ulang",
                    } as Record<string, string>
                  )[update.kind] || update.kind}
                </h3>
                <p>{update.message}</p>
                {update.new_target && (
                  <div className="schedule-change">
                    {update.previous_target && (
                      <>
                        Target sebelumnya {formatDate(update.previous_target)}{" "}
                        →{" "}
                      </>
                    )}
                    Target {formatDate(update.new_target)}
                  </div>
                )}
                {update.photo_path && u && (
                  <a
                    href={photoUrl(update.photo_path)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="update-photo"
                      src={photoUrl(update.photo_path)!}
                      alt="Foto bukti pembaruan perbaikan"
                    />
                  </a>
                )}
                <span className="badge neutral">
                  Progres {update.progress}%
                </span>
              </article>
            ))}
          </section>
          <section className="panel">
            <h2>Lokasi kerusakan</h2>
            <iframe
              className="detail-map"
              title="Lokasi kerusakan pada peta"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${r.longitude - 0.006}%2C${r.latitude - 0.004}%2C${r.longitude + 0.006}%2C${r.latitude + 0.004}&layer=mapnik&marker=${r.latitude}%2C${r.longitude}`}
              loading="lazy"
            />
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <h2>Status penanganan</h2>
            <strong className="big-progress">
              {r.progress}
              <span>%</span>
            </strong>
            <div className="progress-track">
              <span style={{ width: `${r.progress}%` }} />
            </div>
            <DetailFacts report={r} />
            {isOverdue(r) && (
              <p className="form-error">
                Target selesai sudah terlewati. Operator wajib menjelaskan
                kendala dan memperbarui target.
              </p>
            )}
            <p className="help-text">
              Operator wajib memperbarui progres setiap hari sejak tanggal mulai
              perbaikan.
            </p>
          </section>
          {u?.role === "operator" && (
            <section className="panel">
              <h2>Ruang operator</h2>
              <OperatorForm key={`${r.status}-${updates?.length ?? "unavailable"}`} report={r} />
            </section>
          )}
          {own === null && <DataUnavailable message="Data kontribusi kamu belum dapat dimuat. Muat ulang sebelum melanjutkan tindakan pelapor."/>}
          {r.status === "awaiting_confirmation" && own?.[0]?.is_primary && (
            <section className="panel">
              <ConfirmRepair id={r.id} />
            </section>
          )}
          {own !== null && !own.length && !["completed", "rejected"].includes(r.status) && (
            <section className="panel">
              <h3>Menemukan kerusakan yang sama?</h3>
              <p>
                Kirim foto dan lokasi melalui formulir laporan. Laporan serupa
                akan menjadi upvote pada kasus ini.
              </p>
              <Link className="button secondary full" href="/reports/new">
                Kirim bukti laporan <ArrowUpRight size={16} />
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
