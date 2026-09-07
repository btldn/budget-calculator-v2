"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { rollbackImportBatch } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import type { ImportBatchRow } from "@/lib/queries/import";

function formatMoment(value: Date): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImportBatchList({ batches }: { batches: ImportBatchRow[] }) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRollback(id: string) {
    startTransition(async () => {
      const result = await rollbackImportBatch(id);
      setConfirmingId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Импорт откачен, операции удалены");
    });
  }

  if (batches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Выписки ещё не загружали.{" "}
        <Link href="/import" className="underline underline-offset-4">
          Импортировать первую
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {batches.map((batch) => (
        <li key={batch.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{batch.originalFilename}</p>
            <p className="text-sm text-muted-foreground">
              {formatMoment(batch.createdAt)} · {batch.uploadedByName} · создано{" "}
              {batch.importedCount} из {batch.rowCount}
            </p>
          </div>

          {confirmingId === batch.id ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Удалить {batch.importedCount} операций?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() => handleRollback(batch.id)}
              >
                Откатить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmingId(null)}
              >
                Отмена
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmingId(batch.id)}
            >
              Откатить
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
