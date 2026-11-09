"use client";

import Link from "next/link";
import {ReportImage} from "./report-image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowUpRight,
  Clock3,
  LayoutGrid,
  MapPin,
  Search,
  Rows3,
} from "lucide-react";
import { formatDate, statusLabels, type Report } from "@/lib/types";
import { isOverdue } from "@/lib/rules.mjs";
import { orbitSlots, orbitIndices, orbitLayout } from "@/lib/orbit-layout.mjs";

function ReportPreview({report}:{report:Report}){return <div className="landing-report-photo"><ReportImage report={report} width={640} height={400}/></div>;}

function ReportSlide({
  report: r,
  duplicate = false,
}: {
  report: Report;
  duplicate?: boolean;
}) {
  const overdue = isOverdue(r);
  return (
    <Link
      href={`/reports/${r.id}`}
      className="landing-report-card"
      tabIndex={duplicate ? -1 : undefined}
    >
      <div className="landing-report-visual">
        <ReportPreview key={`${r.id}:${r.photo_path}`} report={r} />
        <span
          className={`badge ${overdue ? "danger" : r.status === "completed" ? "success" : "neutral"}`}
        >
          {overdue ? "Terlambat" : statusLabels[r.status] || r.status}
        </span>
      </div>
      <div className="landing-report-body">
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
      </div>
    </Link>
  );
}

const reportIndex = (logical: number, count: number) =>
  ((logical % count) + count) % count;
const orbitStyle = (
  card: ReturnType<typeof orbitLayout>[number],
): CSSProperties =>
  ({
    "--orbit-offset-x": `${card.x}px`,
    "--orbit-z": card.z,
    "--orbit-angle": `${card.angle}deg`,
    opacity: card.opacity,
  }) as CSSProperties;

function ReportOrbit({ reports }: { reports: Report[] }) {
  const viewport = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const phase = useRef(0.5),
    logical = useRef(orbitIndices(0.5));
  const [entries, setEntries] = useState(() => orbitIndices(0.5));
  const geometry = useRef({
    width: 300,
    perspective: 1400,
    depth: 495,
    gap: 12,
    tilt: 0.78,
  });
  useEffect(() => {
    const box = viewport.current,
      ring = stage.current;
    if (!box || !ring) return;
    const slots = Array.from(
      ring.querySelectorAll<HTMLElement>(".report-orbit-slot"),
    );
    let visible = false,
      hovered = false,
      focused = false,
      pressed = false,
      previous = 0,
      frame = 0;
    const paint = () => {
      const layout = orbitLayout(phase.current, geometry.current),
        next = layout.map((card) => card.logical);
      if (next.some((value, index) => value !== logical.current[index])) {
        logical.current = next;
        setEntries(next);
      }
      // Only the frontmost visible copy of each real report enters the tab order.
      const accessible = new Map<number, number>();
      next.forEach((value, index) => {
        const distance = Math.abs(value - phase.current),
          id = reportIndex(value, reports.length);
        if (
          distance < orbitSlots * 0.225 &&
          (!accessible.has(id) ||
            distance < Math.abs(next[accessible.get(id)!] - phase.current))
        )
          accessible.set(id, index);
      });
      slots.forEach((slot, index) => {
        const card = layout[index];
        slot.style.setProperty("--orbit-offset-x", `${card.x.toFixed(4)}px`);
        slot.style.setProperty("--orbit-z", String(card.z));
        slot.style.setProperty("--orbit-angle", `${card.angle}deg`);
        slot.style.opacity = String(card.opacity);
        slot.style.pointerEvents =
          card.front > 0.2 && card.opacity > 0 ? "auto" : "none";
        const exposed =
          accessible.get(reportIndex(next[index], reports.length)) === index;
        slot.setAttribute("aria-hidden", String(!exposed));
        const link = slot.querySelector<HTMLAnchorElement>("a");
        if (link) link.tabIndex = exposed ? 0 : -1;
      });
    };
    const measure = () => {
      const css = getComputedStyle(box),
        width = parseFloat(getComputedStyle(slots[0]).width);
      geometry.current = {
        width,
        perspective: parseFloat(css.perspective),
        depth: width * parseFloat(css.getPropertyValue("--orbit-depth-factor")),
        gap: parseFloat(css.getPropertyValue("--orbit-gap")),
        tilt: parseFloat(css.getPropertyValue("--orbit-tilt-factor")),
      };
      paint();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(box);
    measure();
    const cardAt = (target: EventTarget | null) =>
      target instanceof Element ? target.closest(".landing-report-card") : null;
    const over = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && cardAt(event.target)) hovered = true;
    };
    const out = (event: PointerEvent) => {
      if (event.pointerType !== "touch")
        hovered = Boolean(cardAt(event.relatedTarget));
    };
    const focus = () => {
      focused = true;
      const link = cardAt(document.activeElement);
      if (link?.matches(":focus-visible")) {
        const slot = link.closest<HTMLElement>(".report-orbit-slot");
        if (slot) {
          phase.current = logical.current[Number(slot.dataset.slot)];
          paint();
        }
      }
    };
    const blur = (event: FocusEvent) => {
      if (!box.contains(event.relatedTarget as Node)) focused = false;
    };
    const press = (event: PointerEvent) => {
        if (cardAt(event.target)) pressed = true;
      },
      release = () => {
        pressed = false;
      };
    const visibility = () => {
      previous = 0;
    };
    const observer = new IntersectionObserver((items) => {
      visible = items[0].isIntersecting;
      previous = 0;
    });
    observer.observe(box);
    box.addEventListener("pointerover", over);
    box.addEventListener("pointerout", out);
    box.addEventListener("focusin", focus);
    box.addEventListener("focusout", blur);
    box.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    document.addEventListener("visibilitychange", visibility);
    paint();
    const tick = (now: number) => {
      const delta = previous ? Math.min(now - previous, 64) : 0;
      previous = now;
      if (visible && !document.hidden && !hovered && !focused && !pressed) {
        phase.current += delta / 7000;
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      box.removeEventListener("pointerover", over);
      box.removeEventListener("pointerout", out);
      box.removeEventListener("focusin", focus);
      box.removeEventListener("focusout", blur);
      box.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reports.length]);
  const initial = orbitLayout(phase.current, geometry.current);
  return (
    <div
      ref={viewport}
      className="report-orbit"
      role="region"
      aria-label="Karusel 3D laporan warga"
      aria-roledescription="karusel"
    >
      <div ref={stage} className="report-orbit-stage">
        {entries.map((value, slot) => (
          <div
            className="report-orbit-slot"
            data-slot={slot}
            key={slot}
            style={orbitStyle(initial[slot])}
          >
            <ReportSlide
              report={reports[reportIndex(value, reports.length)]}
              duplicate
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingReports({ reports }: { reports: Report[] }) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [list, setList] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          `${r.title} ${r.address}`
            .toLocaleLowerCase("id-ID")
            .includes(query.trim().toLocaleLowerCase("id-ID")),
      ),
    [reports, status, query],
  );
  const showList = list || reduced;
  return (
    <div className="landing-reports">
      <div className="filter-bar landing-report-filters">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Cari laporan"
            placeholder="Cari laporan atau lokasi..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Semua status</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="landing-report-toolbar">
        <p role="status">
          {filtered.length} laporan
          {query || status !== "all" ? " ditemukan" : ""}
        </p>
        <div>
          {!reduced && (
            <button
              className="report-view-button"
              type="button"
              aria-pressed={list}
              onClick={() => setList(!list)}
            >
              {list ? <Rows3 size={15} /> : <LayoutGrid size={15} />}
              <span>{list ? "Tampilan slider" : "Lihat semua laporan"}</span>
            </button>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="empty">
          <h3>
            {reports.length
              ? "Tidak ada laporan yang cocok"
              : "Mulai perubahan pertama."}
          </h3>
          <p>
            {reports.length
              ? "Coba ubah pencarian atau filter status."
              : "Laporan warga akan tampil di sini setelah dikirim."}
          </p>
          {reports.length > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Hapus filter
            </button>
          )}
        </div>
      ) : showList ? (
        <div className="landing-report-grid">
          {filtered.map((report) => (
            <ReportSlide key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <ReportOrbit
          key={filtered.map((r) => r.id).join(",")}
          reports={filtered}
        />
      )}
    </div>
  );
}
