export type UnknownRow = {
  fingerprint: string;
  kind: "expense" | "income";
  amount: string;
  merchantKey: string;
  merchant: string;
  description: string;
  /** Категория, которую проставили правила. `null` — значит источник новый. */
  categoryId: string | null;
};

export type UnknownGroup = {
  id: string;
  /** Ключевое слово, которое ляжет в словарь. */
  key: string;
  kind: "expense" | "income";
  count: number;
  total: number;
  /** Строки выписки, которые относятся к этому источнику. */
  fingerprints: string[];
  /** Сырой текст из выписки — чтобы понять, что это за источник. */
  sample: string;
};

/** Если мерчанта в выписке нет, ключом становится начало описания. */
function fallbackKey(description: string): string {
  return description.replace(/\s+/g, " ").trim().slice(0, 40).toUpperCase();
}

/**
 * Схлопывает нераспознанные строки в список источников: размечать их по одному
 * разу быстрее, чем по строке, а ключевое слово потом уезжает в `category_rules`.
 *
 * Расходы и доходы одного мерчанта разводятся: у них разные списки категорий.
 */
export function groupUnknownRows(rows: UnknownRow[]): UnknownGroup[] {
  const groups = new Map<string, UnknownGroup>();

  for (const row of rows) {
    if (row.categoryId) continue;

    const key = row.merchantKey || fallbackKey(row.description);
    const id = `${row.kind}|${key}`;

    const group = groups.get(id);
    if (group) {
      group.count += 1;
      group.total += Number(row.amount);
      group.fingerprints.push(row.fingerprint);
      continue;
    }

    groups.set(id, {
      id,
      key,
      kind: row.kind,
      count: 1,
      total: Number(row.amount),
      fingerprints: [row.fingerprint],
      sample: row.merchant || row.description,
    });
  }

  return [...groups.values()].sort((a, b) => b.count - a.count || b.total - a.total);
}
