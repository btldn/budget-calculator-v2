import { CategorySettingsList } from "@/components/category-settings-list";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethodSettingsList } from "@/components/payment-method-settings-list";
import {
  getCategoriesForSettings,
  getPaymentMethodsForSettings,
} from "@/lib/queries/categories";

export default async function SettingsPage() {
  const [categories, paymentMethods] = await Promise.all([
    getCategoriesForSettings(),
    getPaymentMethodsForSettings(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

      <Card>
        <CardContent>
          <h2 className="mb-4 font-medium">Категории расходов</h2>
          <CategorySettingsList
            kind="expense"
            active={categories.expense.active}
            archived={categories.expense.archived}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-4 font-medium">Категории доходов</h2>
          <CategorySettingsList
            kind="income"
            active={categories.income.active}
            archived={categories.income.archived}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-4 font-medium">Способы оплаты</h2>
          <PaymentMethodSettingsList
            active={paymentMethods.active}
            archived={paymentMethods.archived}
          />
        </CardContent>
      </Card>
    </div>
  );
}
