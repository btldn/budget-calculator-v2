"use client";

import { ChevronLeftIcon, PencilIcon, TargetIcon } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import type { SpendContext } from "@/app/actions/payday";
import { createTransaction, updateTransaction } from "@/app/actions/transactions";
import { ChipGroup } from "@/components/chip-group";
import { AmountField } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStepFocus, WizardFrame } from "@/components/wizard-frame";
import { getCategoryEmoji } from "@/lib/category-emoji";
import { makeMoneyFormatter, todayIsoClient, type MoneyFormat } from "@/lib/format-client";
import { parseIsoDate, toIsoDate } from "@/lib/payday/schedule";
import type { CategoryOption } from "@/lib/queries/categories";
import { cn } from "@/lib/utils";

const NO_PAYMENT_METHOD = "none";
const MAX_FREQUENT = 6;
const MAX_AMOUNT = 100_000_000;

type Kind = "expense" | "income";
type Scope = "shared" | "personal";

export type UserOption = { id: string; displayName: string };
export type PaymentMethodOption = { id: string; name: string };
export type GoalOption = {
  id: string;
  title: string;
  targetAmount: string;
  savedAmount: string;
};

// Операция, которую мастер открывает на правку: поля — как в строке истории.
export type EditableTransaction = {
  id: string;
  occurredOn: string;
  kind: Kind;
  amount: string;
  categoryId: string | null;
  scope: Scope;
  paidByUserId: string;
  paymentMethodId: string | null;
  goalId: string | null;
  note: string | null;
};

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[13px] text-muted-foreground">{children}</p>;
}

function CategoryTile({
  category,
  hint,
  selected,
  disabled,
  onPick,
}: {
  category: CategoryOption;
  hint: { text: string; over: boolean } | null;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onPick}
      className={cn(
        "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted active:translate-y-px disabled:opacity-60",
        selected && "border-foreground ring-1 ring-foreground",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="text-base">
          {getCategoryEmoji(category.name)}
        </span>
        <span className="line-clamp-2">{category.name}</span>
      </span>
      {hint && (
        <span className={cn("text-[12px] tabular-nums", hint.over ? "text-destructive" : "text-muted-foreground")}>
          {hint.text}
        </span>
      )}
    </button>
  );
}

function CategorySection({
  ariaLabel,
  heading,
  categories,
  hintFor,
  selectedId,
  disabled,
  onPick,
}: {
  ariaLabel: string;
  heading: string | null;
  categories: CategoryOption[];
  hintFor: (categoryId: string) => { text: string; over: boolean } | null;
  selectedId: string | null;
  disabled: boolean;
  onPick: (categoryId: string) => void;
}) {
  return (
    <section aria-label={ariaLabel} className="space-y-2">
      {heading && <h4 className="text-[13px] font-medium text-muted-foreground">{heading}</h4>}
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            hint={hintFor(category.id)}
            selected={category.id === selectedId}
            disabled={disabled}
            onPick={() => onPick(category.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function TransactionWizard({
  categories,
  users,
  paymentMethods,
  goals,
  currentUserId,
  moneyFormat,
  spend,
  presetCategoryId,
  existing,
  onSaved,
}: {
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
  goals: GoalOption[];
  currentUserId: string;
  moneyFormat: MoneyFormat;
  // Остатки по категориям из бюджета периода; приходят чуть позже открытия окна.
  spend: SpendContext | null;
  // Расход сразу в эту категорию: шаг выбора пропускается, трата сохраняется
  // на шаге с суммой.
  presetCategoryId?: string;
  // Если передана операция — мастер её правит, а не создаёт новую.
  existing?: EditableTransaction;
  onSaved: (saved: { id: string; message: string }) => void;
}) {
  const formatMoney = useMemo(() => makeMoneyFormatter(moneyFormat), [moneyFormat]);
  const locale = moneyFormat.locale;
  const isEdit = !!existing;

  const [step, setStep] = useState<0 | 1>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [kind, setKind] = useState<Kind>(existing?.kind ?? "expense");
  const [amount, setAmount] = useState(existing ? String(Number(existing.amount)) : "");
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? todayIsoClient());
  const [pickOtherDate, setPickOtherDate] = useState(false);
  const [scope, setScope] = useState<Scope>(existing?.scope ?? "shared");
  const [paidByUserId, setPaidByUserId] = useState(existing?.paidByUserId ?? currentUserId);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    existing?.paymentMethodId ?? null,
  );
  const [note, setNote] = useState(existing?.note ?? "");
  // При правке детали (дата, кто платил, комментарий) — как раз то, что чаще всего
  // и меняют, поэтому сразу раскрыты.
  const [detailsOpen, setDetailsOpen] = useState(isEdit);
  const [goalsOpen, setGoalsOpen] = useState(!!existing?.goalId);
  // Сбрасывается по «Сменить»: дальше категорию выбирают на втором шаге.
  const [presetId, setPresetId] = useState<string | null>(presetCategoryId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const headingRef = useStepFocus(String(step));

  const amountNumber = Number(amount);
  const isAmountValid = amountNumber > 0 && amountNumber <= MAX_AMOUNT;
  const isExpense = kind === "expense";

  const today = todayIsoClient();
  const yesterday = (() => {
    const date = parseIsoDate(today);
    date.setDate(date.getDate() - 1);
    return toIsoDate(date);
  })();
  const dateChoice = pickOtherDate ? "other" : occurredOn === today ? "today" : occurredOn === yesterday ? "yesterday" : "other";
  const dateLabel =
    occurredOn === today
      ? "Сегодня"
      : occurredOn === yesterday
        ? "Вчера"
        : occurredOn
          ? parseIsoDate(occurredOn).toLocaleDateString(locale, { day: "numeric", month: "short" })
          : "Дата не указана";

  const payerName = users.find((user) => user.id === paidByUserId)?.displayName;
  const methodName = paymentMethods.find((method) => method.id === paymentMethodId)?.name;
  const detailsSummary = [
    dateLabel,
    scope === "shared" ? "Общее" : "Личное",
    users.length > 1 ? payerName : null,
    methodName ?? null,
    note.trim() ? "с комментарием" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Категории приходят уже по частоте использования; самые частые — в отдельном
  // блоке сверху, чтобы типичная трата была в одном касании от большого пальца.
  const list = isExpense ? categories.expense : categories.income;
  const frequent = list.filter((category) => category.usageCount > 0).slice(0, MAX_FREQUENT);
  const frequentIds = new Set(frequent.map((category) => category.id));
  const others = list.filter((category) => !frequentIds.has(category.id));

  // Предвыбранная категория действует только для расхода: при переключении на
  // доход мастер возвращается к обычному выбору.
  const presetCategory =
    isExpense && presetId ? categories.expense.find((category) => category.id === presetId) : undefined;

  // Остатки считаются на текущего человека — по чужой оплате показывать нечего.
  const showRemaining = isExpense && spend !== null && paidByUserId === currentUserId;

  function consequence(categoryId: string): { text: string; over: boolean } | null {
    if (!showRemaining || !spend) return null;
    const own = spend.remainingByCategory[categoryId];
    if (own !== undefined) {
      const after = own - amountNumber;
      return after >= 0
        ? { text: `останется ${formatMoney(after)}`, over: false }
        : { text: `${formatMoney(-after)} сверх остатка`, over: true };
    }

    // Категория без выделенных денег: трата идёт из «запаса на жизнь». Общую
    // строку про запас показываем один раз сверху, а на плитке — только если
    // запаса уже не хватает.
    if (spend.reserveRemaining === null) return null;
    const afterReserve = spend.reserveRemaining - amountNumber;
    return afterReserve < 0 ? { text: `${formatMoney(-afterReserve)} сверх запаса`, over: true } : null;
  }

  const reserveAfter =
    showRemaining && spend && spend.reserveRemaining !== null
      ? spend.reserveRemaining - amountNumber
      : null;

  function goTo(next: 0 | 1) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setError(null);
  }

  // «Дальше» на шаге с суммой; при предвыбранной категории вместо перехода
  // сразу сохраняет трату.
  function advance() {
    if (!isAmountValid || isPending) return;
    if (presetCategory) save({ categoryId: presetCategory.id, goalId: null }, "Трата сохранена");
    else goTo(1);
  }

  function changePresetCategory() {
    setPresetId(null);
    if (isAmountValid) goTo(1);
  }

  function save(target: { categoryId: string | null; goalId: string | null }, message: string) {
    setError(null);
    startTransition(async () => {
      const values = {
        kind,
        amount: amountNumber,
        occurredOn,
        categoryId: target.categoryId,
        scope,
        paidByUserId,
        paymentMethodId,
        goalId: target.goalId,
        note: note.trim(),
      };

      if (existing) {
        const updated = await updateTransaction(existing.id, values);
        if (!updated.success) {
          setError(updated.error);
          return;
        }
        onSaved({ id: existing.id, message: "Изменения сохранены" });
        return;
      }

      const created = await createTransaction(values);
      if (!created.success) {
        setError(created.error);
        return;
      }
      onSaved({ id: created.data.id, message });
    });
  }

  function pickCategory(categoryId: string) {
    save({ categoryId, goalId: null }, isExpense ? "Трата сохранена" : "Доход сохранён");
  }

  // Подсвечиваем текущую категорию правимой операции; у пополнения цели её нет.
  const selectedCategoryId = existing && !existing.goalId ? existing.categoryId : null;

  const stepBody =
    step === 0 ? (
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Тип операции" className="grid grid-cols-2 gap-1 rounded-lg border p-1">
          {(["expense", "income"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              size="sm"
              variant={kind === value ? "secondary" : "ghost"}
              onClick={() => {
                setKind(value);
                setGoalsOpen(false);
              }}
            >
              {value === "expense" ? "Расход" : "Доход"}
            </Button>
          ))}
        </div>

        {presetCategory && (
          <button
            type="button"
            onClick={changePresetCategory}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span aria-hidden className="text-base">
                {getCategoryEmoji(presetCategory.name)}
              </span>
              <span className="truncate">{presetCategory.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">Сменить</span>
          </button>
        )}

        <AmountField
          value={amount}
          onValueChange={setAmount}
          onEnter={advance}
          currency={moneyFormat.currency}
          placeholder="0"
          aria-label="Сумма"
        />

        <div>
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left text-sm"
          >
            <span className="min-w-0 truncate">{detailsSummary}</span>
            <span className="shrink-0 text-muted-foreground">{detailsOpen ? "Скрыть" : "Изменить"}</span>
          </button>

          {detailsOpen && (
            <div className="space-y-4 pt-4">
              <div>
                <Label>Когда</Label>
                <ChipGroup
                  ariaLabel="Когда"
                  value={dateChoice}
                  onChange={(value) => {
                    if (value === "today") {
                      setOccurredOn(today);
                      setPickOtherDate(false);
                    } else if (value === "yesterday") {
                      setOccurredOn(yesterday);
                      setPickOtherDate(false);
                    } else {
                      setPickOtherDate(true);
                    }
                  }}
                  chips={[
                    { value: "today", label: "Сегодня" },
                    { value: "yesterday", label: "Вчера" },
                    { value: "other", label: "Другая дата" },
                  ]}
                />
                {dateChoice === "other" && (
                  <Input
                    type="date"
                    aria-label="Дата"
                    value={occurredOn}
                    onChange={(event) => setOccurredOn(event.target.value)}
                    className="mt-2 h-10"
                  />
                )}
              </div>

              <div>
                <Label>Чьё</Label>
                <ChipGroup
                  ariaLabel="Чьё"
                  value={scope}
                  onChange={(value) => setScope(value as Scope)}
                  chips={[
                    { value: "shared", label: "Общее" },
                    { value: "personal", label: "Личное" },
                  ]}
                />
              </div>

              {users.length > 1 && (
                <div>
                  <Label>Кто платил</Label>
                  <ChipGroup
                    ariaLabel="Кто платил"
                    value={paidByUserId}
                    onChange={setPaidByUserId}
                    chips={users.map((user) => ({ value: user.id, label: user.displayName }))}
                  />
                </div>
              )}

              {paymentMethods.length > 0 && (
                <div>
                  <Label>Способ оплаты</Label>
                  <ChipGroup
                    ariaLabel="Способ оплаты"
                    value={paymentMethodId ?? NO_PAYMENT_METHOD}
                    onChange={(value) => setPaymentMethodId(value === NO_PAYMENT_METHOD ? null : value)}
                    chips={[
                      { value: NO_PAYMENT_METHOD, label: "Не указан" },
                      ...paymentMethods.map((method) => ({ value: method.id, label: method.name })),
                    ]}
                  />
                </div>
              )}

              <div>
                <Label>Комментарий</Label>
                <Input
                  value={note}
                  maxLength={500}
                  placeholder="Необязательно"
                  aria-label="Комментарий"
                  onChange={(event) => setNote(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      advance();
                    }
                  }}
                  className="h-10"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => goTo(0)}
          className="flex items-center gap-2 rounded-full bg-muted px-3.5 py-1.5 text-sm tabular-nums"
        >
          <span className="font-semibold">{formatMoney(amountNumber)}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <PencilIcon className="size-3" />
            изменить
          </span>
        </button>

        {reserveAfter !== null && (
          <p
            className={cn(
              "text-[13px] tabular-nums",
              reserveAfter < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            Траты вне выделенных категорий — из запаса на жизнь:{" "}
            {reserveAfter >= 0
              ? `останется ${formatMoney(reserveAfter)}`
              : `не хватает ${formatMoney(-reserveAfter)}`}
            .
          </p>
        )}

        {!isExpense && !isEdit && (
          <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">
            Зарплату лучше вносить кнопкой «Пришла зарплата» на дашборде — она сразу разложит деньги по
            категориям и целям.
          </p>
        )}

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Категорий пока нет — добавьте их в настройках.
          </p>
        ) : (
          <>
            {frequent.length > 0 && (
              <CategorySection
                ariaLabel="Частые категории"
                heading="Часто"
                categories={frequent}
                hintFor={consequence}
                selectedId={selectedCategoryId}
                disabled={isPending}
                onPick={pickCategory}
              />
            )}
            {others.length > 0 && (
              <CategorySection
                ariaLabel="Остальные категории"
                heading={frequent.length > 0 ? "Остальные" : null}
                categories={others}
                hintFor={consequence}
                selectedId={selectedCategoryId}
                disabled={isPending}
                onPick={pickCategory}
              />
            )}
          </>
        )}

        {isExpense && goals.length > 0 && (
          <section aria-label="Цели" className="space-y-2">
            <button
              type="button"
              aria-expanded={goalsOpen}
              onClick={() => setGoalsOpen((open) => !open)}
              className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
            >
              <TargetIcon className="size-4" />
              Отложить в цель
              <span className="ml-auto text-[12px] font-normal text-muted-foreground">
                {goalsOpen ? "Скрыть" : "Выбрать цель"}
              </span>
            </button>
            {goalsOpen && (
              <div className="grid gap-2">
                {goals.map((goal) => {
                  const target = Number(goal.targetAmount);
                  const saved = Number(goal.savedAmount);
                  const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => save({ categoryId: null, goalId: goal.id }, "Отложено в цель")}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted active:translate-y-px disabled:opacity-60",
                        goal.id === existing?.goalId && "border-foreground ring-1 ring-foreground",
                      )}
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{goal.title}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {percent}% · ещё {formatMoney(Math.max(0, target - saved))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    );

  const footer =
    step === 0 ? (
      <div className="flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" className="h-11 w-full" disabled={!isAmountValid || isPending} onClick={advance}>
          {presetCategory ? (isPending ? "Сохраняем…" : "Сохранить") : "Дальше"}
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" className="h-11 px-4" disabled={isPending} onClick={() => goTo(0)}>
            <ChevronLeftIcon />
            Назад
          </Button>
          <p className="text-[13px] text-muted-foreground">
            {isPending
              ? "Сохраняем…"
              : isEdit
                ? "Нажмите категорию — изменения сохранятся."
                : "Нажмите категорию — операция сохранится."}
          </p>
        </div>
      </div>
    );

  return (
    <WizardFrame
      progress={{ current: step, total: presetCategory ? 1 : 2 }}
      title={
        step === 0
          ? isEdit
            ? "Изменить операцию"
            : isExpense
              ? "Сколько потратили"
              : "Сколько пришло"
          : isExpense
            ? "Куда"
            : "Что за доход"
      }
      headingRef={headingRef}
      stepKey={String(step)}
      direction={direction}
      footer={footer}
    >
      {stepBody}
    </WizardFrame>
  );
}
