"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  UsersRound,
  Construction,
  Route,
  CircleHelp,
  Ticket,
  Menu,
  X,
} from "lucide-react";

const sections = [
  { id: "tentang-kita", label: "Tentang kita", icon: UsersRound },
  { id: "cara-kerja", label: "Cara kerja", icon: Route },
  { id: "laporan", label: "Laporan", icon: Construction },
  { id: "voucher", label: "Voucher", icon: Ticket },
  { id: "faq", label: "FAQ", icon: CircleHelp },
];

export function SiteHeader({
  brand,
  actions,
  children,
}: {
  brand: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname(),
    landing = pathname === "/",
    accountArea =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/reports/new");
  const header = useRef<HTMLElement>(null);
  const [floating, setFloating] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (!landing) return;
    const update = () => setFloating(window.scrollY > 48);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [landing]);
  useEffect(() => {
    if (!landing || !open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        header.current
          ?.querySelector<HTMLButtonElement>(".landing-menu-toggle")
          ?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [landing, open]);
  return (
    <header
      ref={header}
      className={`header${landing ? ` landing-header${floating ? " is-floating" : ""}${open ? " menu-open" : ""}` : ""}`}
    >
      <div className="nav-wrap">
        {brand}
        {landing ? (
          <nav id="landing-navigation" aria-label="Informasi LaporKUY!">
            {sections.map(({ id, label, icon: Icon }) => (
              <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
                <Icon size={15} />
                {label}
              </a>
            ))}
          </nav>
        ) : (
          accountArea ? (
            <nav aria-label="Navigasi utama">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/profile/reports">Jelajahi Laporan</Link>
              <Link href="/profile/vouchers" aria-current={pathname === "/profile/vouchers" ? "page" : undefined}>Voucher</Link>
            </nav>
          ) : (
            children
          )
        )}
        <div className="nav-actions" onClick={() => setOpen(false)}>
          {actions}
        </div>
        {landing && (
          <button
            className="landing-menu-toggle"
            type="button"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="landing-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        )}
      </div>
    </header>
  );
}
