import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { safeNext } from "./rules.mjs";
import type { Report, Viewer } from "./types";
export const configured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
export async function backend(
  path: string,
  init: RequestInit = {},
  token?: string,
) {
  if (!configured()) throw new Error("Koneksi database belum dikonfigurasi.");
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(20000)]),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        "Permintaan gagal. Silakan coba lagi.",
    );
  return payload;
}
export async function accessToken() {
  return (await cookies()).get("lk_access")?.value;
}
export const viewer = cache(async (): Promise<Viewer | null> => {
  const token = await accessToken();
  if (!token || !configured()) return null;
  try {
    const u = await backend("/auth/v1/user", {}, token);
    return {
      id: u.id,
      email: u.email,
      role: u.app_metadata?.role === "operator" ? "operator" : "user",
      name: u.user_metadata?.full_name || u.email.split("@")[0],
      emailConfirmed: Boolean(u.email_confirmed_at),
    };
  } catch {
    return null;
  }
});
export async function requireViewer(operator = false, next = "/dashboard") {
  const user = await viewer();
  if (!user)
    redirect(`/?auth=login&next=${encodeURIComponent(safeNext(next))}`);
  if (operator && user.role !== "operator") redirect("/dashboard");
  return user;
}
export async function rpc(name: string, args: Record<string, unknown>, signal?: AbortSignal) {
  const token = await accessToken();
  if (!token) throw new Error("Silakan masuk terlebih dahulu.");
  return backend(
    `/rest/v1/rpc/${name}`,
    { method: "POST", body: JSON.stringify(args), signal },
    token,
  );
}
export async function reports(): Promise<Report[]> {
  if (!configured()) return [];
  return backend(
    "/rest/v1/reports?select=*&order=created_at.desc&limit=200",
    {},
    await accessToken(),
  );
}
export function photoUrl(path: string | null) {
  return path ? `/api/photo?path=${encodeURIComponent(path)}` : null;
}

// Request-scoped cache: never share a citizen's balance across requests.
export const pointBalance = cache(async (): Promise<number | null> => {
  const user = await viewer();
  if (!user) return null;
  try {
    const rows: { amount: number }[] = await backend(
      `/rest/v1/point_ledger?select=amount&user_id=eq.${user.id}`,
      {}, await accessToken(),
    );
    return rows.reduce((sum, row) => sum + row.amount, 0);
  } catch {
    return null;
  }
});
