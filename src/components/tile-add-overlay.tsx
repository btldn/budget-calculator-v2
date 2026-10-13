"use client";

import { useAddTransactionDialog } from "@/components/add-transaction-provider";

// Невидимая кнопка на всю плашку: клик открывает окно новой траты с уже
// выбранной категорией. Кнопка лежит под «Заплатил» и «Историей» (у тех z-index
// выше), поэтому ссылки не оказываются внутри другой кнопки.
export function TileAddOverlay({ categoryId, name }: { categoryId: string; name: string }) {
  const { openForCategory } = useAddTransactionDialog();

  return (
    <button
      type="button"
      aria-label={`Добавить трату: ${name}`}
      onClick={() => openForCategory(categoryId)}
      className="absolute inset-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
