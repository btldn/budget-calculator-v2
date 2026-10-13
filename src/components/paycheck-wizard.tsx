"use client";

import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePaycheck, recordPaycheck } from "@/app/actions/payday";
import { parseUnits } from "@/components/money-input";
import {
  AmountStep,
  DoneStep,
  LiveStep,
  SaveStep,
  type PayOption,
  type SaveRow,
  type SplitBarData,
} from "@/components/paycheck-steps";
import { Button } from "@/components/ui/button";
import { useStepFocus, WizardFrame } from "@/components/wizard-frame";
import { makeMoneyFormatter, todayIsoClient } from "@/lib/format-client";
import { planGoal } from "@/lib/goals";
import { distributePaycheck, fromCents, toCents } from "@/lib/payday/distribute";
import {
  daysBetween,
  nextPaydayAfter,
  parseIsoDate,
  pendingPayday,
} from "@/lib/payday/schedule";
import type { PaydayContext } from "@/lib/queries/payday";

const EXTRA = "__extra__";
// Выплата без графика: график ещё не заполнен, но зарплату внести уже хочется.
const PLAIN = "__plain__";

type StepId = "amount" | "live" | "save";

export function PaycheckWizard({
  context,
  onClose,
}: {
  context: PaydayContext;
  onClose: () => void;
}) {
  const formatMoney = useMemo(() => makeMoneyFormatter(context.moneyFormat), [context.moneyFormat]);
  const [today] = useState(() => new Date());
  const { slots } = context;

  const pending = pendingPayday(slots, context.lastRegular, today);
  const initialChoice = slots.length === 0 ? PLAIN : (pending?.slot.id ?? slots[0].id);

  const [choice, setChoice] = useState(initialChoice);
  const [amount, setAmount] = useState(() => {
    const last = context.lastAmountBySlot[initialChoice];
    return last ? String(last) : "";
  });
  const [receivedOn, setReceivedOn] = useState(todayIsoClient);
  const [incomeCategoryId, setIncomeCategoryId] = useState(
    () =>
      (context.incomeCategories.find((c) => c.name === "Зарплата") ?? context.incomeCategories[0])
        ?.id ?? "",
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Правки вручную; пока их нет, показываем то, что насчитал алгоритм.
  const [reserveEdit, setReserveEdit] = useState<string | null>(null);
  const [goalEdits, setGoalEdits] = useState<Record<string, string>>({});

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [result, setResult] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUndoing, startUndo] = useTransition();

  const isExtra = choice === EXTRA;
  const paySlotId = choice === EXTRA || choice === PLAIN ? null : choice;
  const amountCents = Math.max(0, toCents(amount || 0));

  // Шаги зависят от выплаты: у внеплановой нет «жить», без целей нет «копим».
  const hasSave = context.goals.length > 0;
  const flow: StepId[] = ["amount"];
  if (!isExtra) flow.push("live");
  if (hasSave) flow.push("save");
  const currentIndex = Math.min(stepIndex, flow.length - 1);
  const step: StepId | "done" = result ? "done" : flow[currentIndex];
  const isLastStep = currentIndex === flow.length - 1;

  const distribution = useMemo(
    () =>
      distributePaycheck({
        amountCents,
        isExtra,
        slotCount: slots.length || 1,
        paySlotId,
        categories: context.categories.map((category) => ({
          id: category.id,
          monthlyLimitCents: toCents(category.monthlyLimit),
          payScheduleId: category.payScheduleId,
        })),
        goals: context.goals.map((goal) => {
          const plan = planGoal(goal, today);
          return {
            id: goal.id,
            remainingCents: plan.status === "achieved" ? 0 : toCents(plan.remaining),
            months: plan.status === "deadline" ? plan.months : null,
            depositedThisMonthCents: toCents(goal.depositedThisMonth),
          };
        }),
        reserveMonthlyCents: toCents(context.reserveMonthly),
        reservePerPaymentCents: reserveEdit !== null ? parseUnits(reserveEdit) * 100 : undefined,
      }),
    [amountCents, isExtra, slots.length, paySlotId, context, today, reserveEdit],
  );

  // Суммы целей и запаса в полях — целые; хвост копеек остаётся «свободно».
  const reserveUnits = Math.floor(distribution.reserveCents / 100);
  const reserveValue = reserveEdit ?? String(reserveUnits);
  const goalValue = (goalId: string) =>
    goalEdits[goalId] ??
    String(Math.floor((distribution.goals.find((g) => g.goalId === goalId)?.totalCents ?? 0) / 100));
  const goalUnits = (goalId: string) => parseUnits(goalValue(goalId));

  const categoriesCents = distribution.categories.reduce((sum, c) => sum + c.amountCents, 0);
  const goalsCents = context.goals.reduce((sum, goal) => sum + goalUnits(goal.id) * 100, 0);
  const liveCents = categoriesCents + reserveUnits * 100;
  const unallocatedCents = amountCents - liveCents - goalsCents;
  const isOver = unallocatedCents < 0;
  const freeCents = Math.max(0, unallocatedCents);

  const bar: SplitBarData = { totalCents: amountCents, liveCents, saveCents: goalsCents, freeCents, isOver };

  // До какого дня хватит денег: от плановой даты этой выплаты до следующей по графику.
  const next = useMemo(() => {
    const slot = slots.find((s) => s.id === paySlotId);
    if (!slot || !receivedOn) return null;
    return nextPaydayAfter(slots, slot, receivedOn);
  }, [slots, paySlotId, receivedOn]);
  const locale = context.moneyFormat.locale;
  const periodLabel = next
    ? `до ${next.date.toLocaleDateString(locale, { day: "numeric", month: "long" })}`
    : "до следующей зарплаты";
  const daysLeft = next ? Math.max(1, daysBetween(today, next.date)) : null;
  const perDayCents = daysLeft ? Math.round(liveCents / daysLeft) : null;

  const categoryNames = new Map(context.categories.map((c) => [c.id, c.name]));
  const spendRows = distribution.categories
    .filter((c) => c.amountCents > 0)
    .map((c) => ({ id: c.categoryId, name: categoryNames.get(c.categoryId) ?? "", amountCents: c.amountCents }));

  const reserveCapped = reserveEdit !== null && parseUnits(reserveEdit) * 100 > distribution.reserveCents;
  const reserveHint = reserveCapped
    ? `После трат и целей по сроку хватает только на ${formatMoney(distribution.reserveCents / 100)}`
    : context.reserveMonthly > 0
      ? "по тому, сколько уходило сверх лимитов за последние месяцы"
      : "истории трат пока мало — можно задать вручную";
  const cushion =
    !hasSave && context.avgMonthlySpend > 0
      ? {
          low: Math.round(context.avgMonthlySpend * 3),
          high: Math.round(context.avgMonthlySpend * 6),
        }
      : null;

  const saveRows: SaveRow[] = context.goals.map((goal, index) => {
    const allocation = distribution.goals.find((g) => g.goalId === goal.id);
    const plan = planGoal(goal, today);
    let caption: string;
    if (plan.status === "achieved") caption = "Цель закрыта";
    else if (allocation && allocation.byDeadlineCents > 0)
      caption =
        `по сроку ${formatMoney(fromCents(allocation.byDeadlineCents))}` +
        (allocation.byPriorityCents > 0
          ? ` + из остатка ${formatMoney(fromCents(allocation.byPriorityCents))}`
          : "");
    else if (allocation && allocation.byPriorityCents > 0) caption = "из остатка по приоритету";
    else caption = `ещё ${formatMoney(plan.remaining)} до цели`;

    return { id: goal.id, rank: index + 1, title: goal.title, caption, value: goalValue(goal.id) };
  });

  const slotOptions: PayOption[] = [
    ...slots.map((slot) => ({ value: slot.id, label: slot.label, hint: `${slot.dayOfMonth} числа` })),
    ...(slots.length === 0 ? [{ value: PLAIN, label: "Зарплата", hint: "обычная" }] : []),
    { value: EXTRA, label: "Внеплановая", hint: "премия, подработка" },
  ];

  const dateLabel =
    receivedOn === todayIsoClient()
      ? `Сегодня, ${today.toLocaleDateString(locale, { day: "numeric", month: "short" })}`
      : receivedOn
        ? parseIsoDate(receivedOn).toLocaleDateString(locale, { day: "numeric", month: "short" })
        : "Дата не указана";

  const canAdvance =
    step === "amount" ? amountCents > 0 && !!incomeCategoryId && !!receivedOn : step === "save" ? !isOver : true;

  const headingRef = useStepFocus(step);

  function goTo(index: number) {
    setDirection(index > currentIndex ? 1 : -1);
    setStepIndex(index);
    setError(null);
  }

  function resetEdits() {
    setReserveEdit(null);
    setGoalEdits({});
  }

  function changeChoice(value: string) {
    setChoice(value);
    const last = context.lastAmountBySlot[value];
    if (last) setAmount(String(last));
    resetEdits();
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await recordPaycheck({
        amount: fromCents(amountCents),
        receivedOn,
        isExtra,
        paySlotId,
        incomeCategoryId,
        categories: distribution.categories.map((c) => ({
          categoryId: c.categoryId,
          amount: fromCents(c.amountCents),
        })),
        goals: context.goals.map((goal) => ({ goalId: goal.id, amount: goalUnits(goal.id) })),
        reserve: reserveUnits,
      });

      if (!response.success) {
        setError(response.error);
        return;
      }
      setDirection(1);
      setResult({ id: response.data.id });
    });
  }

  function advance() {
    if (!canAdvance || isPending) return;
    if (isLastStep) submit();
    else goTo(currentIndex + 1);
  }

  function undo() {
    if (!result) return;
    startUndo(async () => {
      const response = await deletePaycheck(result.id);
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      toast.success("Выплата отменена");
      onClose();
    });
  }

  const transferLines = [
    ...context.goals
      .map((goal) => ({ label: goal.title, cents: goalUnits(goal.id) * 100 }))
      .filter((line) => line.cents > 0),
    ...(freeCents >= 100
      ? [{ label: "Не распределено", cents: Math.floor(freeCents / 100) * 100 }]
      : []),
    ...(!isExtra && context.previousPeriodSaved > 0
      ? [{ label: "Сэкономлено в прошлом периоде", cents: toCents(context.previousPeriodSaved) }]
      : []),
  ];
  const transferTotal = transferLines.reduce((sum, line) => sum + line.cents, 0);

  const titles: Record<StepId | "done", string> = {
    amount: "Сколько пришло",
    live: `Жить ${periodLabel}`,
    save: "Копим",
    done: "Зарплата распределена",
  };

  const footer =
    step === "done" ? (
      <div className="flex flex-col gap-1.5">
        <Button type="button" className="h-11 w-full" onClick={onClose}>
          Готово
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={isUndoing} onClick={undo}>
          Отменить выплату
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-1.5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              disabled={isPending}
              onClick={() => goTo(currentIndex - 1)}
            >
              <ChevronLeftIcon />
              Назад
            </Button>
          )}
          <Button type="button" className="h-11 flex-1" disabled={!canAdvance || isPending} onClick={advance}>
            {isLastStep ? "Распределить зарплату" : "Дальше"}
          </Button>
        </div>
        {step === "live" && hasSave && (
          <Button type="button" variant="link" className="w-full" disabled={isOver || isPending} onClick={submit}>
            Принять план целиком
          </Button>
        )}
      </div>
    );

  return (
    <WizardFrame
      progress={step === "done" ? undefined : { current: currentIndex, total: flow.length }}
      title={titles[step]}
      titleIcon={
        step === "done" ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-positive text-background">
            <CheckIcon className="size-4" />
          </span>
        ) : undefined
      }
      headingRef={headingRef}
      stepKey={step}
      direction={direction}
      footer={footer}
    >
      {step === "amount" && (
        <AmountStep
          options={slotOptions}
          choice={choice}
          onChoice={changeChoice}
          isExtra={isExtra}
          amount={amount}
          onAmount={(value) => {
            setAmount(value);
            resetEdits();
          }}
          onEnter={advance}
          currency={context.moneyFormat.currency}
          lastAmount={context.lastAmountBySlot[choice] ?? null}
          formatMoney={formatMoney}
          dateLabel={dateLabel}
          receivedOn={receivedOn}
          onReceivedOn={setReceivedOn}
          incomeCategories={context.incomeCategories}
          incomeCategoryId={incomeCategoryId}
          onIncomeCategory={setIncomeCategoryId}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
        />
      )}
      {step === "live" && (
        <LiveStep
          formatMoney={formatMoney}
          bar={bar}
          spendableCents={liveCents}
          perDayCents={perDayCents}
          daysLeft={daysLeft}
          categoriesCents={categoriesCents}
          spendRows={spendRows}
          shortfallCents={distribution.categoriesShortfallCents}
          reserveValue={reserveValue}
          onReserve={(value) => {
            setReserveEdit(value);
            setGoalEdits({});
          }}
          reserveHint={reserveHint}
          cushion={cushion}
        />
      )}
      {step === "save" && (
        <SaveStep
          formatMoney={formatMoney}
          bar={bar}
          rows={saveRows}
          onGoal={(id, value) => setGoalEdits((edits) => ({ ...edits, [id]: value }))}
          goalsCents={goalsCents}
          sharePercent={amountCents > 0 ? Math.round((goalsCents / amountCents) * 100) : 0}
          showBenchmark={!isExtra}
          freeCents={unallocatedCents}
          isOver={isOver}
        />
      )}
      {step === "done" && (
        <DoneStep
          formatMoney={formatMoney}
          isExtra={isExtra}
          periodLabel={periodLabel}
          spendableCents={liveCents}
          perDayCents={perDayCents}
          transfers={{ lines: transferLines, totalCents: transferTotal }}
        />
      )}
    </WizardFrame>
  );
}
