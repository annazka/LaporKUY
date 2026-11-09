"use client";
import Link from "next/link";
import { AuthLink } from "./auth-modal";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Check,
  MailCheck,
  LoaderCircle,
  Link2Off,
  ShieldCheck,
} from "lucide-react";
import { callbackInput } from "@/lib/email-confirmation.mjs";

import {PasswordRecovery} from "./password-recovery";

type State = "loading" | "success" | "error" | "empty";
async function verify(body: unknown) {
  const response = await fetch("/api/auth/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.confirmed)
    throw new Error(
      result.error || "Konfirmasi belum berhasil. Silakan coba kembali.",
    );
}
export function EmailConfirmation() {
 const [recovery,setRecovery]=useState<boolean|null>(null);
 useEffect(()=>{const read=()=>{const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);setRecovery(location.pathname==='/auth/reset'||(hash.get('type')||query.get('type'))==='recovery');};read();window.addEventListener('hashchange',read);window.addEventListener('popstate',read);return()=>{window.removeEventListener('hashchange',read);window.removeEventListener('popstate',read);};},[]);
 if(recovery===null)return <section className="account-recovery" role="status">Memeriksa tautan…</section>;
 return recovery?<PasswordRecovery/>:<SignupConfirmation/>;
}
function SignupConfirmation() {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");
  const automatic = useRef<Promise<void> | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    let active = true;
    if (!initialized.current) {
      initialized.current = true;
      const input = callbackInput(window.location.hash, window.location.search);
      // Remove all tokens and provider error parameters before rendering status.
      window.history.replaceState(null, "", "/auth/confirm");
      if (input.kind === "session" && input.access_token) {
        automatic.current = verify({ access_token: input.access_token });
      } else if (input.kind === "token" && input.token_hash) {
        automatic.current = verify({
          token_hash: input.token_hash,
          type: "email",
        });
      } else if (input.kind === "invalid") {
        setState("error");
        setMessage(
          "Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Jika email sudah dikonfirmasi, kamu bisa langsung masuk.",
        );
      } else setState("empty");
    }
    automatic.current
      ?.then(() => {
        if (active) setState("success");
      })
      .catch((e: Error) => {
        if (active) {
          setState("error");
          setMessage(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const success = state === "success",
    error = state === "error";
  return (
    <div className="confirmation-wrap container">
      <div className="confirmation-ambient" aria-hidden="true" />
      <section
        className="confirmation-card panel"
        aria-live="polite"
        aria-busy={state === "loading"}
      >
        <div className="confirmation-label">
          <span /> VERIFIKASI AKUN LAPORKUY
        </div>
        <div
          className={`confirmation-symbol ${success ? "confirmed" : error ? "failed" : ""}`}
        >
          {state === "loading" ? (
            <LoaderCircle className="confirmation-spinner" size={35} />
          ) : success ? (
            <Check size={39} />
          ) : error ? (
            <Link2Off size={34} />
          ) : (
            <MailCheck size={36} />
          )}
        </div>
        <h1>
          {state === "loading"
            ? "Memeriksa konfirmasi email."
            : success
              ? "Email terkonfirmasi."
              : error
                ? "Konfirmasi belum berhasil."
                : "Konfirmasi email kamu."}
        </h1>
        <p>
          {state === "loading"
            ? "Tunggu sebentar, kami sedang memeriksa status emailmu."
            : success
              ? "Akunmu siap digunakan. Terima kasih sudah ikut menjaga Jakarta. Masuk untuk mulai mengirim laporan dan memantau perbaikannya."
              : error
                ? message
                : "Buka tautan konfirmasi yang kami kirim saat kamu mendaftar. Setelah verifikasi berhasil, kamu bisa masuk ke akun LaporKUY!"}
        </p>
        {state !== "loading" && (
          <AuthLink className="button full">
            {success ? "Masuk ke LaporKUY!" : "Coba masuk ke akun"}
            <ArrowUpRight size={17} />
          </AuthLink>
        )}
        {state !== "loading" && (
          <Link href="/" className="confirmation-back">
            <ArrowLeft size={14} />
            Kembali ke beranda
          </Link>
        )}
        <div className="confirmation-footer">
          <ShieldCheck size={14} /> Identitasmu tetap terlindungi.
        </div>
      </section>
      <span className="confirmation-bottom">SUARA WARGA. AKSI NYATA.</span>
    </div>
  );
}
