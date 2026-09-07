"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { commitImport, previewImport, type ImportPreview } from "@/app/actions/import";
import { ImportDropzone } from "@/components/import-dropzone";
import {
  ImportPreviewTable,
  type ImportRowState,
  type UserOption,
} from "@/components/import-preview-table";
import {
  ImportUnknownMerchants,
  type UnknownGroupState,
} from "@/components/import-unknown-merchants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { makeMoneyFormatter, type MoneyFormat } from "@/lib/format-client";
import { groupUnknownRows, type UnknownGroup } from "@/lib/import/group-unknown";
import type { CategoryOption } from "@/lib/queries/categories";

type PaymentMethodOption = { id: string; name: string };

type ImportDefaults = { paidByUserId: string; scope: "shared" | "personal" };

export function ImportWizard({
  categories,
  users,
  paymentMethods,
  currentUserId,
  money,
}: {
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
  currentUserId: string;
  money: MoneyFormat;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rowState, setRowState] = useState<Record<string, ImportRowState>>({});
  const [groups, setGroups] = useState<UnknownGroup[]>([]);
  const [groupState, setGroupState] = useState<Record<string, UnknownGroupState>>({});
  const [defaults, setDefaults] = useState<ImportDefaults>({
    paidByUserId: currentUserId,
    scope: "shared",
  });
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const formatMoney = useMemo(() => makeMoneyFormatter(money), [money]);
  const paymentMethodNames = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods],
  );

  function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await previewImport(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setSummary(null);
      setPreview(result.data);
      setRowState(
        Object.fromEntries(
          result.data.rows.map((row) => [
            row.fingerprint,
            {
              // Дубли выключены заранее — включить их можно вручную.
              selected: row.duplicate === null,
              categoryId: row.categoryId,
              scope: row.scope ?? defaults.scope,
              paidByUserId: defaults.paidByUserId,
              remember: false,
            } satisfies ImportRowState,
          ]),
        ),
      );
      // Состав групп фиксируем на момент разбора, иначе карточка схлопывалась бы
      // под руками по мере разметки.
      const unknown = groupUnknownRows(result.data.rows);
      setGroups(unknown);
      setGroupState(
        Object.fromEntries(
          unknown.map((group) => [
            group.id,
            { categoryId: null, keyword: group.key, toDictionary: true },
          ]),
        ),
      );

      for (const warning of result.data.warnings) toast.warning(warning);
    });
  }

  /** Категория, выбранная для источника, проставляется всем его операциям. */
  function patchGroup(id: string, patch: Partial<UnknownGroupState>) {
    setGroupState((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));

    if (patch.categoryId === undefined) return;

    const group = groups.find((candidate) => candidate.id === id);
    if (!group) return;

    setRowState((previous) => {
      const next = { ...previous };
      for (const fingerprint of group.fingerprints) {
        next[fingerprint] = { ...next[fingerprint], categoryId: patch.categoryId ?? null };
      }
      return next;
    });
  }

  function resetPreview() {
    setPreview(null);
    setRowState({});
    setGroups([]);
    setGroupState({});
  }

  function patchRow(fingerprint: string, patch: Partial<ImportRowState>) {
    setRowState((previous) => ({
      ...previous,
      [fingerprint]: { ...previous[fingerprint], ...patch },
    }));
  }

  function toggleAll(selected: boolean) {
    setRowState((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([key, value]) => [key, { ...value, selected }]),
      ),
    );
  }

  /** Умолчание сверху применяется ко всем строкам — точечные правки после него. */
  function applyDefault(patch: Partial<ImportDefaults>) {
    setDefaults((previous) => ({ ...previous, ...patch }));
    setRowState((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([key, value]) => [key, { ...value, ...patch }]),
      ),
    );
  }

  const groupsToRemember = groups.filter((group) => {
    const state = groupState[group.id];
    return state?.toDictionary && state.categoryId;
  });
  const shortKeywords = groupsToRemember.filter(
    (group) => groupState[group.id].keyword.trim().length < 2,
  );

  const selectedRows = preview?.rows.filter((row) => rowState[row.fingerprint]?.selected) ?? [];
  const withoutCategory = selectedRows.filter((row) => !rowState[row.fingerprint]?.categoryId);
  const selectedExpense = selectedRows
    .filter((row) => row.kind === "expense")
    .reduce((total, row) => total + Number(row.amount), 0);

  function handleImport() {
    if (!preview) return;

    if (selectedRows.length === 0) {
      toast.error("Не выбрано ни одной операции.");
      return;
    }
    if (withoutCategory.length > 0) {
      toast.error(`Осталось ${withoutCategory.length} строк без категории — они подсвечены.`);
      return;
    }
    if (shortKeywords.length > 0) {
      toast.error("Ключевое слово для словаря должно быть хотя бы из двух символов.");
      return;
    }

    // Все строки источника уносят его ключевое слово; сервер дедуплицирует их сам.
    const keywordByFingerprint = new Map<string, string>();
    for (const group of groupsToRemember) {
      const keyword = groupState[group.id].keyword.trim().toUpperCase();
      for (const fingerprint of group.fingerprints) keywordByFingerprint.set(fingerprint, keyword);
    }

    startTransition(async () => {
      const result = await commitImport({
        originalFilename: preview.originalFilename,
        rowCount: preview.rows.length,
        rows: selectedRows.map((row) => {
          const state = rowState[row.fingerprint];
          return {
            fingerprint: row.fingerprint,
            occurredOn: row.occurredOn,
            kind: row.kind,
            amount: row.amount,
            categoryId: state.categoryId as string,
            paymentMethodId: row.paymentMethodId,
            paidByUserId: state.paidByUserId,
            scope: state.scope,
            note: row.note,
            rememberPattern:
              keywordByFingerprint.get(row.fingerprint) ??
              (state.remember && row.merchantKey ? row.merchantKey : null),
          };
        }),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      resetPreview();
      setSummary({ imported: result.data.importedCount, skipped: result.data.skippedCount });
      toast.success(`Импортировано операций: ${result.data.importedCount}`);
    });
  }

  if (!preview) {
    return (
      <div className="space-y-4">
        <ImportDropzone onFile={handleFile} disabled={isPending} />

        {isPending && <p className="text-sm text-muted-foreground">Разбираю файл…</p>}

        {summary && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                Создано операций: <strong>{summary.imported}</strong>
                {summary.skipped > 0 && `, пропущено: ${summary.skipped}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/history" />}
              >
                Открыть историю
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Кто платил</span>
            <Select
              items={Object.fromEntries(users.map((user) => [user.id, user.displayName]))}
              value={defaults.paidByUserId}
              onValueChange={(value) => applyDefault({ paidByUserId: value as string })}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Чьё</span>
            <Select
              items={{ shared: "Общее", personal: "Личное" }}
              value={defaults.scope}
              onValueChange={(value) =>
                applyDefault({ scope: value as ImportDefaults["scope"] })
              }
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">Общее</SelectItem>
                <SelectItem value="personal">Личное</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="ml-auto text-sm text-muted-foreground">
            {preview.originalFilename} — операций в файле: {preview.rows.length}
          </p>
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <ImportUnknownMerchants
          groups={groups}
          state={groupState}
          categories={categories}
          formatMoney={formatMoney}
          onChange={patchGroup}
        />
      )}

      {withoutCategory.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlertIcon className="size-4 shrink-0" />
          Без категории осталось {withoutCategory.length} операций — задайте категорию
          источнику в карточке выше или правьте построчно.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <ImportPreviewTable
          rows={preview.rows}
          state={rowState}
          categories={categories}
          users={users}
          paymentMethodNames={paymentMethodNames}
          formatMoney={formatMoney}
          onChange={patchRow}
          onToggleAll={toggleAll}
        />
      </Card>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:bottom-4">
        <p className="text-sm">
          Будет создано <strong>{selectedRows.length}</strong> из {preview.rows.length}
          {selectedExpense > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · расходов на {formatMoney(selectedExpense)}
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={resetPreview}
            disabled={isPending}
          >
            Отменить
          </Button>
          <Button type="button" onClick={handleImport} disabled={isPending}>
            {isPending ? "Импортирую…" : "Импортировать"}
          </Button>
        </div>
      </div>
    </div>
  );
}
