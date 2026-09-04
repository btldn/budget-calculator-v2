import { AddTransactionProvider } from "@/components/add-transaction-provider";
import { AddTransactionTrigger } from "@/components/add-transaction-trigger";
import { DashboardNav } from "@/components/dashboard-nav";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { UserSwitcher } from "@/components/user-switcher";
import { getAllUsers, getCurrentUser } from "@/lib/current-user";
import { getAllPaymentMethods, getCategoriesByKind } from "@/lib/queries/categories";
import { getGoals } from "@/lib/queries/goals";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [users, currentUser, categories, paymentMethods, goals] = await Promise.all([
    getAllUsers(),
    getCurrentUser(),
    getCategoriesByKind(),
    getAllPaymentMethods(),
    getGoals(),
  ]);

  const shell = (
    <div className="flex flex-1 flex-col bg-muted">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-card">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="font-heading text-base font-semibold">Бюджет</span>
            <DashboardNav />
          </div>
          <div className="flex items-center gap-3">
            {currentUser && <AddTransactionTrigger />}
            <UserSwitcher users={users} currentUserId={currentUser?.id ?? null} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-6">
        {children}
      </main>
      <MobileBottomNav showAddButton={!!currentUser} />
    </div>
  );

  if (!currentUser) return shell;

  return (
    <AddTransactionProvider
      categories={categories}
      users={users}
      paymentMethods={paymentMethods}
      goals={goals}
      currentUserId={currentUser.id}
    >
      {shell}
    </AddTransactionProvider>
  );
}
