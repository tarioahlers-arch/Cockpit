"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/users", label: "Nutzer" },
  { href: "/admin/tasks", label: "Aufgaben" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/reports", label: "Meldungen" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
            pathname === l.href
              ? "border-primary text-primary-dark"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
