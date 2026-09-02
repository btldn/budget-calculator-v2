import Link from "next/link";

import { UserSwitcher } from "@/components/user-switcher";
import { getAllUsers, getCurrentUser } from "@/lib/current-user";

const NAV_ITEMS = [
  { href: "/", label: "Дашборд" },
  { href: "/history", label: "История" },
  { href: "/goals", label: "Цели" },
  { href: "/settings", label: "Настройки" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [users, currentUser] = await Promise.all([
    getAllUsers(),
    getCurrentUser(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-4 text-sm font-medium">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <UserSwitcher users={users} currentUserId={currentUser?.id ?? null} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
