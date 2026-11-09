import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { rpc } from "@/lib/backend";
const validPriorities = ["low", "medium", "high", "urgent"];
export async function POST(request: Request) {
  try {
    await authorize(request, true);
    const b = await request.json();
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
      if (
        b.action === "priority" &&
        err instanceof Error &&
        /Aksi tidak valid/i.test(err.message) &&
        (b.status === "scheduled" || b.status === "in_progress")
      ) {
        try {
          await rpc("operator_update", { ...payload, p_action: "reschedule" });
        } catch {
          await rpc("operator_update", { ...payload, p_action: "progress" });
        }
      } else {
        throw err;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
