import { ImportWizard } from "@/components/import-wizard";
import { moneyFormat } from "@/lib/format";
import { getAllUsers, getCurrentUser } from "@/lib/current-user";
import { getAllPaymentMethods, getCategoriesByKind } from "@/lib/queries/categories";

export default async function ImportPage() {
  const [currentUser, users, categories, paymentMethods] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getCategoriesByKind(),
    getAllPaymentMethods(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Импорт выписки</h1>
        <p className="text-sm text-muted-foreground">
          Загрузите .xlsx из интернет-банка. Категории расставятся по правилам, а всё, что
          правила не узнали, вы разметите прямо в таблице перед сохранением.
        </p>
      </div>

      {currentUser ? (
        <ImportWizard
          categories={categories}
          users={users}
          paymentMethods={paymentMethods}
          currentUserId={currentUser.id}
          money={moneyFormat()}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Сначала выберите пользователя в шапке — импорт записывается от его имени.
        </p>
      )}
    </div>
  );
}
