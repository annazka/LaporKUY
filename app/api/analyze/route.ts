import { NextResponse } from "next/server";
import { authorize } from "@/lib/http";
import { GeminiError } from "@/lib/gemini.mjs";
import { createAnalysisService } from "@/lib/analysis-service.mjs";
import {issueReportDraft} from "@/lib/report-draft.mjs";
export const runtime = "nodejs";
export const maxDuration = 60;
const analysis = createAnalysisService();
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
  try {
    const user = await authorize(request);
    signal.throwIfAborted();
    if (Number(request.headers.get("content-length") || 0) > 4300000)
      return NextResponse.json(
        { error: "Foto maksimal 4 MB." },
        { status: 413 },
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { error: "Pilih foto untuk dianalisis." },
        { status: 400 },
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await analysis.run(
      user.id,
      bytes,
      file.type,
      { signal },
    );
    return NextResponse.json({...result,report_token:issueReportDraft(user.id,bytes,file.type,result)}, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof GeminiError)
      return NextResponse.json(
        { error: e.message, code: e.code, retryAfter: e.retryAfter },
        {
          status: e.status,
          headers: {
            "Cache-Control": "no-store",
            ...(e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {}),
          },
        },
      );
    if (signal.aborted)
      return NextResponse.json(
        {
          error:
            signal.reason?.name === "TimeoutError"
              ? "Analisis melewati batas waktu. Foto tetap tersedia; silakan coba lagi."
              : "Analisis dibatalkan.",
          code:
            signal.reason?.name === "TimeoutError" ? "TIMEOUT" : "CANCELLED",
        },
        { status: signal.reason?.name === "TimeoutError" ? 504 : 499 },
      );
    if (e instanceof Error && e.message === "Silakan masuk terlebih dahulu.")
      return NextResponse.json(
        {
          error:
            "Sesi masuk berakhir. Silakan masuk kembali sebelum mencoba analisis.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 },
      );
    if (e instanceof Error && e.message === "Asal permintaan tidak valid.")
      return NextResponse.json(
        {
          error: "Permintaan tidak valid. Muat ulang halaman lalu coba lagi.",
          code: "INVALID_ORIGIN",
        },
        { status: 403 },
      );
    return NextResponse.json(
      {
        error:
          "Analisis belum berhasil. Foto tetap tersedia; silakan coba lagi.",
        code: "ANALYSIS_FAILED",
      },
      { status: 400 },
    );
  }
}
