import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { rpc } from "@/lib/backend";
import { validCoordinates } from "@/lib/rules.mjs";
import {verifyReportReceipt} from "@/lib/report-draft.mjs";
import {findPhotoDuplicate} from '@/lib/report-duplicate';
import {GeminiError} from '@/lib/gemini.mjs';
export const maxDuration=60;
export async function POST(request: Request) {
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(55000)]);
  try {
    const user = await authorize(request);
    const b = await request.json();
    if (b.action === "confirm" || b.action === "reopen") {
      await rpc("confirm_report", {
        p_report_id: b.id,
        p_accept: b.action === "confirm",
        p_message: String(b.message || ""),
      });
      return NextResponse.json({ ok: true });
    }
    const lat = Number(b.latitude),
      lng = Number(b.longitude);
    if (!validCoordinates(lat, lng))
      throw new Error("Lokasi harus berada di wilayah Jakarta daratan.");
    if (!String(b.photo_path || "").startsWith(user.id + "/"))
      throw new Error("Unggah foto bukti terlebih dahulu.");
    const draft = verifyReportReceipt(b.report_receipt,user.id,b.photo_path);
    const match=await findPhotoDuplicate({userId:user.id,category:draft.category,latitude:lat,longitude:lng,photoPath:b.photo_path,signal});
    const data = await rpc("submit_report_ai", {
      p_title: String(b.title || ""),
      p_description: draft.description,
      p_category: draft.category,
      p_address: String(b.address || ""),
      p_latitude: lat,
      p_longitude: lng,
      p_photo_path: b.photo_path,
      p_duplicate_report_id: match?.report_id||null,
    },signal);
    return NextResponse.json(data);
  } catch (e) {
    if(e instanceof GeminiError)return NextResponse.json({error:e.message,code:e.code,retryAfter:e.retryAfter},{status:e.status,headers:{'Cache-Control':'no-store',...(e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});
    if(signal.aborted)return NextResponse.json({error:'Pemeriksaan foto melewati batas waktu atau dibatalkan. Foto tetap tersedia; coba kirim lagi.'},{status:signal.reason?.name==='TimeoutError'?504:499});
    return failure(e);
  }
}
