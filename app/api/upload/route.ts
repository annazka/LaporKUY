import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { accessToken } from "@/lib/backend";
import {issueReportReceipt} from "@/lib/report-draft.mjs";
export async function POST(request: Request) {
  try {
    const u = await authorize(request);
    const data = await request.formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 4 * 1024 * 1024
    )
      throw new Error("Gunakan foto JPG, PNG, atau WebP maksimal 4 MB.");
    const ext: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    if (!ext[file.type]) throw new Error("Format foto tidak didukung.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216
        : file.type === "image/png"
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) throw new Error("Isi file bukan foto yang valid.");
    const path = `${u.id}/${crypto.randomUUID()}.${ext[file.type]}`;
    const reportToken = data.get("report_token");
    const receipt = reportToken === null ? null : issueReportReceipt(reportToken,u.id,bytes,file.type,path);
    const r = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/report-photos/${path}`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${await accessToken()}`,
          "Content-Type": file.type,
        },
        body: bytes,
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!r.ok) throw new Error("Foto gagal diunggah. Silakan coba kembali.");
    return NextResponse.json({ path, ...(receipt?{report_receipt:receipt}:{}) });
  } catch (e) {
    return failure(e);
  }
}
