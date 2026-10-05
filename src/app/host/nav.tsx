"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/host", label: "Oggi", exact: true },
  { href: "/host/bookings", label: "Prenotazioni" },
  { href: "/host/properties", label: "Appartamenti" },
];

export function HostNav({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  if (variant === "bottom") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cx("flex min-h-14 flex-1 items-center justify-center text-sm", active(l.href, l.exact) ? "font-semibold text-accent" : "text-fg-muted")}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cx("rounded-xl px-3 py-2.5 text-sm", active(l.href, l.exact) ? "bg-muted font-semibold text-fg" : "text-fg-muted hover:bg-muted")}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
