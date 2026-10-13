import Link from "next/link";

import { CategorySettingsList } from "@/components/category-settings-list";
import { ImportBatchList } from "@/components/import-batch-list";
import { PaycheckList } from "@/components/paycheck-list";
import { PayScheduleSettingsList } from "@/components/pay-schedule-settings-list";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethodSettingsList } from "@/components/payment-method-settings-list";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user";
import { moneyFormat } from "@/lib/format";
import {
  getCategoriesForSettings,
  getPaymentMethodsForSettings,
} from "@/lib/queries/categories";
import { getImportBatches } from "@/lib/queries/import";
import { getPaycheckHistory, getPaySchedules } from "@/lib/queries/payday";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();

  const [categories, paymentMethods, importBatches, paySlots, paychecks] = await Promise.all([
    getCategoriesForSettings(currentUser?.id ?? ""),
    getPaymentMethodsForSettings(),
    getImportBatches(),
    currentUser ? getPaySchedules(currentUser.id) : [],
    currentUser ? getPaycheckHistory(currentUser.id) : [],
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

      {currentUser && (
        <Card>
          <CardContent>
            <div className="mb-4">
              <h2 className="font-medium">Зарплата</h2>
              <p className="text-sm text-muted-foreground">
                Когда приходят деньги у {currentUser.displayName}. От выплаты до выплаты
                считается, сколько можно потратить.
              </p>
            </div>
            <PayScheduleSettingsList
              // Поля строк держат локальный state — при смене пользователя пересоздаём.
              key={currentUser.id}
              slots={paySlots}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <div className="mb-4">
            <h2 className="font-medium">Категории расходов</h2>
            {currentUser && (
              <p className="text-sm text-muted-foreground">
                Лимиты показаны и редактируются для {currentUser.displayName} —
                переключите пользователя в шапке, чтобы задать лимиты другого.
              </p>
            )}
          </div>
          <CategorySettingsList
            // Лимиты в строках — персональные; при смене активного пользователя
            // список нужно пересоздать, а не просто обновить пропсы, иначе
            // локальный state полей лимита останется от предыдущего человека.
            key={currentUser?.id ?? "none"}
            kind="expense"
            active={categories.expense.active}
            archived={categories.expense.archived}
            paySlots={paySlots}
          />
        </CardContent>
      </Card>

      {currentUser && (
        <Card>
          <CardContent>
            <div className="mb-4">
              <h2 className="font-medium">История зарплат</h2>
              <p className="text-sm text-muted-foreground">
                Внесённую выплату можно откатить — вместе с отложенным на цели.
              </p>
            </div>
            <PaycheckList paychecks={paychecks} moneyFormat={moneyFormat()} />
          </CardContent>
        </Card>
      )}

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

      <Card>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">История импортов</h2>
              <p className="text-sm text-muted-foreground">
                Загруженную выписку можно откатить целиком — вместе со всеми её операциями.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/import" />}
            >
              Импортировать выписку
            </Button>
          </div>
          <ImportBatchList batches={importBatches} />
        </CardContent>
      </Card>
    </div>
  );
}
