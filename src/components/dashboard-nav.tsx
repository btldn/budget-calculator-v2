"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Дашборд" },
  { href: "/history", label: "История" },
  { href: "/goals", label: "Цели" },
  { href: "/settings", label: "Настройки" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-[10px] px-3 py-1.5 transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
