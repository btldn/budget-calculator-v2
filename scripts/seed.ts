import { db } from "../src/db";
import { categories, paymentMethods, users } from "../src/db/schema";

const EXPENSE_CATEGORIES = [
  "Жильё / аренда",
  "Коммуналка",
  "Продукты",
  "Кафе и рестораны",
  "Транспорт",
  "Здоровье и аптека",
  "Спорт",
  "Одежда и обувь",
  "Красота и уход",
  "Развлечения",
  "Подписки и сервисы",
  "Связь и интернет",
  "Подарки",
  "Путешествия",
  "Образование",
  "Дом и быт",
  "Питомцы",
  "Кредиты и рассрочки",
  "Прочие расходы",
];

const DEFAULT_MONTHLY_LIMITS: Record<string, string> = {
  "Жильё / аренда": "25000",
  "Продукты": "30000",
  "Кафе и рестораны": "12000",
  "Транспорт": "12000",
  "Развлечения": "15000",
};

const INCOME_CATEGORIES = [
  "Зарплата",
  "Фриланс / подработка",
  "Премия",
  "Инвестиции и проценты",
  "Возвраты и кэшбэк",
  "Прочий доход",
];

const PAYMENT_METHODS = ["Карта", "Наличные", "Перевод", "Автоплатёж", "Другое"];

const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }
  return value;
}

async function seedUsers() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log("Пользователи уже есть, пропускаю.");
    return;
  }

  const names = [requireEnv("USER1_NAME"), requireEnv("USER2_NAME")];

  for (const displayName of names) {
    await db.insert(users).values({ displayName });
    console.log(`Создан пользователь: ${displayName}`);
  }
}

async function seedCategories() {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .limit(1);
  if (existing.length > 0) {
    console.log("Категории уже есть, пропускаю.");
    return;
  }

  let sortOrder = 0;
  let colorIndex = 0;
  const rows = [
    ...EXPENSE_CATEGORIES.map((name) => ({ name, kind: "expense" as const })),
    ...INCOME_CATEGORIES.map((name) => ({ name, kind: "income" as const })),
  ].map((row) => ({
    ...row,
    color: CATEGORY_COLORS[colorIndex++ % CATEGORY_COLORS.length],
    sortOrder: sortOrder++,
    monthlyLimit: DEFAULT_MONTHLY_LIMITS[row.name] ?? null,
  }));

  await db.insert(categories).values(rows);
  console.log(`Создано категорий: ${rows.length}`);
}

async function seedPaymentMethods() {
  const existing = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .limit(1);
  if (existing.length > 0) {
    console.log("Способы оплаты уже есть, пропускаю.");
    return;
  }

  await db
    .insert(paymentMethods)
    .values(PAYMENT_METHODS.map((name) => ({ name })));
  console.log(`Создано способов оплаты: ${PAYMENT_METHODS.length}`);
}

async function main() {
  await seedUsers();
  await seedCategories();
  await seedPaymentMethods();
  console.log("Сидирование завершено.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
