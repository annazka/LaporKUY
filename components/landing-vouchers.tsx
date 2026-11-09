"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Ticket, Gift, X, Check } from "lucide-react";
import { AuthLink } from "./auth-modal";
import type { Voucher } from "@/lib/types";
import { formatDate } from "@/lib/types";
import { jakartaDate } from "@/lib/rules.mjs";
type Redemption = {
  id: string;
  code: string;
  voucher_id: string;
  created_at: string;
};
export function LandingVouchers({
  vouchers,
  balance,
  signedIn,
  failed,
  accountFailed,
  redemptions,
  catalog = false,
}: {
  catalog?: boolean;
  vouchers: Voucher[];
  balance: number;
  signedIn: boolean;
  failed: boolean;
  accountFailed: boolean;
  redemptions: Redemption[];
}) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState("all"), [availability, setAvailability] = useState("all");
  const [selected, setSelected] = useState<Voucher | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [code, setCode] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    inFlight = useRef(false),
    router = useRouter();
  const visible = selected !== null;
  useEffect(() => {
    if (!visible) return;
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [visible]);
  function open(v: Voucher) {
    setError("");
    setCode("");
    setSelected(v);
  }
  function close() {
    if (!inFlight.current) setSelected(null);
  }
  async function redeem() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Penukaran belum berhasil.");
      if (typeof result.code !== "string" || !result.code)
        throw new Error(
          "Kode belum diterima. Periksa riwayat sebelum mencoba kembali.",
        );
      setCode(result.code);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof TypeError || e instanceof DOMException
          ? "Koneksi terputus. Periksa riwayat penukaran sebelum mencoba lagi."
          : e instanceof Error
            ? e.message
            : "Penukaran belum berhasil.",
      );
      router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const available = (v: Voucher) =>
    v.stock > 0 && v.valid_until >= jakartaDate();
  const categories = [...new Set(vouchers.map(v => v.category))].sort();
  const filtered = catalog ? vouchers.filter(v =>
    (category === "all" || v.category === category) &&
    `${v.name} ${v.description}`.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")) &&
    (availability === "all" || (available(v) && (availability !== "affordable" || (!accountFailed && v.cost <= balance))))
  ) : vouchers.slice(0, 3);
  const art = (v: Voucher) =>
    v.category === "Edukasi"
      ? "museum"
      : v.category === "Olahraga"
        ? "sport"
        : "park";
  return (
    <section
      id="voucher"
      className={`container section landing-vouchers${catalog ? " voucher-catalog" : ""}`}
      aria-labelledby="voucher-title"
    >
      <div className="section-heading">
        <div>
          {catalog ? <h1 id="voucher-title">Voucher</h1> : <h2 id="voucher-title">
            Tukar poin
            <br />
            <span>dengan voucher simulasi.</span>
          </h2>}
        </div>
        <div className="landing-point-balance">
          <Gift size={23} />
          <div>
            <small>Poin simulasi</small>
            <strong>
              {signedIn
                ? accountFailed
                  ? "Belum dapat dimuat"
                  : `${balance.toLocaleString("id-ID")} poin`
                : "Masuk untuk melihat saldo"}
            </strong>
          </div>
        </div>
      </div>
      <div className="voucher-disclaimer">
        <Ticket size={19} />
        <p>
          Program simulasi · Poin dan voucher belum berlaku sebagai tiket atau
          penawaran dari mitra.
        </p>
      </div>
      {catalog && <div className="voucher-filters">
        <label>Cari voucher<input aria-label="Cari voucher" type="search" placeholder="Nama atau deskripsi voucher" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <label>Kategori<select aria-label="Kategori" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Semua kategori</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Ketersediaan<select aria-label="Ketersediaan" value={availability} onChange={e => setAvailability(e.target.value)}><option value="all">Semua voucher</option><option value="available">Masih tersedia</option><option value="affordable" disabled={accountFailed}>Sesuai poin saya</option></select></label>
      </div>}
      {failed ? (
        <p role="status">
          Pilihan voucher belum dapat dimuat. Muat ulang halaman untuk mencoba
          kembali.
        </p>
      ) : !vouchers.length ? (
        <p>Belum ada pilihan voucher. Cek kembali nanti.</p>
      ) : !filtered.length ? <div className="voucher-filter-empty"><p role="status">Tidak ada voucher yang sesuai dengan filter.</p><button className="button secondary" onClick={() => {setQuery("");setCategory("all");setAvailability("all");}}>Reset filter</button></div> : (
        <div className="landing-voucher-grid">
          {filtered.map((v) => (
            <article className="landing-voucher-card" key={v.id}>
              <div className="voucher-destination">
                <img
                  src={`/media/vouchers/${art(v)}.jpg`}
                  alt={`Ilustrasi ${v.category.toLowerCase()}`}
                  loading="lazy"
                />
                <span>Simulasi</span>
                <small>Foto ilustrasi</small>
              </div>
              <div className="landing-voucher-content">
                <small>{v.category}</small>
                <h3>{v.name}</h3>
                <p>{v.description}</p>
                <div className="ticket-perforation" />
                <div className="landing-voucher-cost">
                  <strong>
                    {v.cost.toLocaleString("id-ID")} <small>poin</small>
                  </strong>
                  <span>
                    {available(v) ? `${v.stock} tersedia` : "Tidak tersedia"}
                  </span>
                </div>
                <button
                  className="button secondary full"
                  type="button"
                  onClick={() => open(v)}
                >
                  Lihat voucher <ArrowUpRight size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="section-footnote">
        Poin simulasi diberikan setelah perbaikan selesai dan terkonfirmasi: 100
        untuk pelapor utama, 20 untuk pelapor tambahan.
      </p>
      {signedIn && accountFailed && (
        <p role="status">
          Saldo dan riwayat belum dapat dimuat. Penukaran dinonaktifkan
          sementara.
        </p>
      )}
      {signedIn && redemptions.length > 0 && (
        <details className="voucher-history">
          <summary>Voucher simulasimu · {redemptions.length} penukaran</summary>
          {redemptions.map((r) => (
            <div key={r.id}>
              <span>
                {vouchers.find((v) => v.id === r.voucher_id)?.name ||
                  "Voucher simulasi"}
                <small>{formatDate(r.created_at)}</small>
              </span>
              <code>{r.code}</code>
            </div>
          ))}
        </details>
      )}
      <dialog
        ref={dialog}
        className="voucher-dialog"
        aria-labelledby="voucher-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const b = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < b.left ||
              e.clientX > b.right ||
              e.clientY < b.top ||
              e.clientY > b.bottom
            )
              close();
          }
        }}
      >
        {selected && (
          <>
            <button
              type="button"
              className="voucher-dialog-close"
              aria-label="Tutup detail voucher"
              disabled={busy}
              onClick={close}
            >
              <X size={20} />
            </button>
            <span className="voucher-modal-tag">
              <Ticket size={16} /> Voucher simulasi
            </span>
            <h2 id="voucher-dialog-title">{selected.name}</h2>
            <p>{selected.description}</p>
            <dl>
              <div>
                <dt>Poin yang diperlukan</dt>
                <dd>{selected.cost.toLocaleString("id-ID")} poin</dd>
              </div>
              <div>
                <dt>Stok saat ini</dt>
                <dd>{selected.stock}</dd>
              </div>
              <div>
                <dt>Berlaku sampai</dt>
                <dd>{formatDate(selected.valid_until)}</dd>
              </div>
            </dl>
            <p className="voucher-modal-terms">
              Penukaran mengurangi poin dan stok simulasi. Kode hanya untuk
              pengujian LaporKUY! dan tidak bisa digunakan di lokasi wisata atau
              mitra.
            </p>
            {code ? (
              <div className="voucher-success" role="status">
                <Check size={22} />
                <strong>Penukaran simulasi berhasil</strong>
                <code>{code}</code>
                <p>Kode tersimpan pada riwayat voucher di bawah.</p>
              </div>
            ) : (
              <>
                {error && (
                  <p className="voucher-error" role="alert">
                    {error}
                  </p>
                )}
                {signedIn ? (
                  <>
                    <button
                      className="button full"
                      type="button"
                      disabled={
                        busy ||
                        accountFailed ||
                        !available(selected) ||
                        balance < selected.cost
                      }
                      onClick={redeem}
                    >
                      {busy
                        ? "Menukar…"
                        : !available(selected)
                          ? "Voucher tidak tersedia"
                          : accountFailed
                            ? "Saldo belum tersedia"
                            : balance < selected.cost
                              ? "Poin belum cukup"
                              : `Tukar ${selected.cost} poin`}
                    </button>
                    <p className="section-footnote">
                      Saldo kamu:{" "}
                      {accountFailed
                        ? "belum tersedia"
                        : `${balance.toLocaleString("id-ID")} poin`}
                    </p>
                  </>
                ) : (
                  <div onClick={close}>
                    <AuthLink className="button full" next="/rewards">
                      Masuk untuk menukar <ArrowUpRight size={16} />
                    </AuthLink>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </dialog>
    </section>
  );
}
