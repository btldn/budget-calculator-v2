import { normalizeMerchant } from "./normalize";

export type CategoryRule = {
  id: string;
  matchType: "contains" | "regex";
  pattern: string;
  categoryId: string;
  scope: "shared" | "personal" | null;
  priority: number;
};

export type RuleTarget = {
  merchant: string;
  description: string;
};

function haystacks({ merchant, description }: RuleTarget): string[] {
  return [normalizeMerchant(merchant), merchant, description].filter(Boolean);
}

function matches(rule: CategoryRule, values: string[]): boolean {
  if (rule.matchType === "regex") {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, "iu");
    } catch {
      // Битое правило не должно ронять весь импорт.
      return false;
    }
    return values.some((value) => regex.test(value));
  }

  const needle = rule.pattern.trim().toUpperCase();
  if (!needle) return false;
  return values.some((value) => value.toUpperCase().includes(needle));
}

/**
 * Возвращает правило с наибольшим приоритетом, подошедшее к операции,
 * или `null`, если ни одно не совпало — такую строку разметит человек.
 */
export function applyRules(rules: CategoryRule[], target: RuleTarget): CategoryRule | null {
  const values = haystacks(target);
  if (values.length === 0) return null;

  let best: CategoryRule | null = null;
  for (const rule of rules) {
    if (!matches(rule, values)) continue;
    if (!best || rule.priority > best.priority) best = rule;
  }

  return best;
}
