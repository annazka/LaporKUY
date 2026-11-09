"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, LoaderCircle, RotateCcw } from "lucide-react";
import {
  AnalysisRequestError,
  photoFingerprint,
  sendPhotoForAnalysis,
  validatePhoto,
} from "@/lib/photo-analysis-client.mjs";

export type Analysis = {
  report_token?: string | null;
  relevant: boolean;
  category: string;
  severity: string;
  priority: string;
  summary: string;
  reason: string;
  model: string;
};
type State = {
  file: File | null;
  stage: "idle" | "uploading" | "analyzing" | "success" | "error";
  result?: Analysis;
  error?: string;
  retryAt?: number;
  invalid?: boolean;
};
export function PhotoAnalysis({ file, onResult, onBusyChange }: { file: File | null; onResult?: (result: Analysis, file: File) => void; onBusyChange?: (busy: boolean) => void }) {
  const [state, setState] = useState<State>({ file: null, stage: "idle" }),
    [attempt, setAttempt] = useState(0),
    [preview, setPreview] = useState<{ file: File; url: string } | null>(null),
    [retryWait, setRetryWait] = useState(0);
  const generation = useRef(0),
    pending = useRef(false),
    cache = useRef(new Map<string, Analysis>());
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    const id = ++generation.current,
      controller = new AbortController();
    const current = () =>
      generation.current === id && !controller.signal.aborted;
    pending.current = false;
    if (!file) {
      setState({ file: null, stage: "idle" });
      return () => controller.abort();
    }
    const invalid = validatePhoto(file);
    if (invalid) {
      setState({ file, stage: "error", error: invalid, invalid: true });
      return () => controller.abort();
    }
    pending.current = true;
    setState({ file, stage: "uploading" });
    (async () => {
      try {
        const fingerprint = await photoFingerprint(file);
        if (!current()) return;
        let result = cache.current.get(fingerprint);
        if (!result) {
          result = (await sendPhotoForAnalysis(file, {
            signal: controller.signal,
            onPhase: (stage: "uploading" | "analyzing") => {
              if (current()) setState({ file, stage });
            },
          })) as Analysis;
          if (!current()) return;
          if (cache.current.size >= 8)
            cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(fingerprint, result);
        }
        if (current()) setState({ file, stage: "success", result });
      } catch (error) {
        if (!current()) return;
        const retryAfter =
          error instanceof AnalysisRequestError ? error.retryAfter : 0;
        setState({
          file,
          stage: "error",
          error:
            error instanceof AnalysisRequestError
              ? error.message
              : "Analisis belum berhasil. Foto tetap tersedia; silakan coba lagi.",
          retryAt: Date.now() + retryAfter * 1000,
        });
      } finally {
        if (current()) pending.current = false;
      }
    })();
    return () => {
      controller.abort();
    };
  }, [file, attempt]);
  useEffect(() => {
    const update = () =>
      setRetryWait(
        state.retryAt
          ? Math.max(0, Math.ceil((state.retryAt - Date.now()) / 1000))
          : 0,
      );
    update();
    if (!state.retryAt) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [state.retryAt]);
  useEffect(() => {
    if (file && state.file === file && state.stage === "success" && state.result)
      onResult?.(state.result, file);
  }, [file, state, onResult]);
  useEffect(() => {
    onBusyChange?.(Boolean(file && (state.file !== file || state.stage === "uploading" || state.stage === "analyzing")));
  }, [file, state, onBusyChange]);
  if (!file) return null;
  const active: State =
    state.file === file ? state : { file, stage: "uploading" };
  const result = active.result,
    busy = active.stage === "uploading" || active.stage === "analyzing";
  return (
    <section
      className="photo-analysis form-stack"
      aria-label="Pratinjau dan analisis foto"
      aria-busy={busy}
    >
      {preview?.file === file && (
        <figure className="photo-preview">
          <img
            src={preview.url}
            alt="Pratinjau foto yang dipilih untuk laporan"
          />
          <figcaption>{file.name}</figcaption>
        </figure>
      )}
      <div className="analysis-heading">
        <Sparkles size={17} />
        <strong>Analisis otomatis</strong>
      </div>
      {busy && (
        <div className="analysis-progress" role="status" aria-live="polite">
          <LoaderCircle size={18} className="analysis-spinner" />
          <span>
            {active.stage === "uploading"
              ? "Mengunggah gambar…"
              : "Menganalisis gambar…"}
          </span>
        </div>
      )}
      {active.error && (
        <div className="form-error" role="alert">
          <p>{active.error}</p>
          {!active.invalid && (
            <button
              type="button"
              className="button secondary"
              disabled={retryWait > 0 || busy}
              onClick={() => {
                if (pending.current) return;
                pending.current = true;
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw size={16} />
              {retryWait > 0 ? `Coba Lagi (${retryWait} dtk)` : "Coba Lagi"}
            </button>
          )}
        </div>
      )}
      {result && (
        <div className="notice" role="status">
          <div>
            <strong>
              {result.relevant
                ? "Kerusakan terdeteksi"
                : "Foto belum sesuai sebagai bukti kerusakan"}
            </strong>
            <p style={{ marginTop: 10 }}>{result.summary}</p>
            <div className="facts">
              <div>
                <span>Jenis kerusakan</span>
                <b>{result.category}</b>
              </div>
              <div>
                <span>Tingkat kerusakan</span>
                <b>{result.severity.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase())}</b>
              </div>
              <div>
                <span>Prioritas penanganan</span>
                <b>
                  {(
                    {
                      low: "Rendah",
                      medium: "Sedang",
                      high: "Tinggi",
                      urgent: "Darurat",
                      unknown: "Belum dapat ditentukan",
                    } as Record<string, string>
                  )[result.priority] || "Belum dapat ditentukan"}
                </b>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
