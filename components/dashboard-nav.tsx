"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {accountLinks} from "@/lib/account-navigation.mjs";
export function DashboardNav() {
  const path = usePathname();
  return (
    <nav className="dashboard-side" aria-label="Navigasi akun">
      {accountLinks.map(({href, label}) => (
        <Link
          key={href}
          className={path === href ? "active" : ""}
          aria-current={path === href ? "page" : undefined}
          href={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
