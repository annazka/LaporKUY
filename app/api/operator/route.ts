import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { rpc } from "@/lib/backend";
const validPriorities = ["low", "medium", "high", "urgent"];
export async function POST(request: Request) {
  try {
    await authorize(request, true);
    const b = await request.json();
    if (
      b.action === "priority" &&
      (typeof b.priority !== "string" || !validPriorities.includes(b.priority))
    ) {
      throw new Error("Prioritas tidak valid.");
    }
    const priority = validPriorities.includes(b.priority)
      ? b.priority
      : "medium";
    const payload = {
      p_report_id: b.id,
      p_action: b.action,
      p_message: String(b.message || ""),
      p_progress: Number(b.progress || 0),
      p_start: b.start_date || null,
      p_target: b.target_date || null,
      p_priority: priority,
      p_photo_path: b.photo_path || null,
    };
    try {
      await rpc("operator_update", payload);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : String((err as { message?: unknown })?.message || "");
      if (b.action === "priority" && /Aksi tidak valid/i.test(msg)) {
        throw new Error(
          "Aksi pembaruan prioritas belum tersedia di database. Jalankan migrasi 202611090001_operator_priority_update.sql.",
        );
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
