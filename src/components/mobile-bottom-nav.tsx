"use client";

import { HistoryIcon, HomeIcon, PlusIcon, SettingsIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAddTransactionDialog } from "@/components/add-transaction-provider";
import { cn } from "@/lib/utils";

const LEFT_ITEMS = [
  { href: "/", label: "Дашборд", icon: HomeIcon },
  { href: "/history", label: "История", icon: HistoryIcon },
];

const RIGHT_ITEMS = [
  { href: "/goals", label: "Цели", icon: TargetIcon },
  { href: "/settings", label: "Настройки", icon: SettingsIcon },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function AddTransactionNavButton() {
  const { open } = useAddTransactionDialog();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-end py-2">
      <button
        type="button"
        onClick={open}
        className="absolute -top-5 flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
      >
        <PlusIcon className="size-6" />
        <span className="sr-only">Добавить трату</span>
      </button>
      <span className="pt-6 text-[11px] font-medium text-muted-foreground">Добавить</span>
    </div>
  );
}

export function MobileBottomNav({ showAddButton }: { showAddButton: boolean }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
      {LEFT_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
      ))}
      {showAddButton && <AddTransactionNavButton />}
      {RIGHT_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
      ))}
    </nav>
  );
}
