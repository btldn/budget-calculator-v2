import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const transactionKind = pgEnum("transaction_kind", [
  "expense",
  "income",
]);
export const transactionScope = pgEnum("transaction_scope", [
  "shared",
  "personal",
]);
export const importSource = pgEnum("import_source", ["csv", "txt", "xlsx"]);
export const ruleMatchType = pgEnum("rule_match_type", ["contains", "regex"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: transactionKind("kind").notNull(),
  monthlyLimit: numeric("monthly_limit", { precision: 12, scale: 2 }),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: importSource("source").notNull(),
  originalFilename: text("original_filename").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id")
    .notNull()
    .references(() => users.id),
  rowCount: integer("row_count").notNull(),
  importedCount: integer("imported_count").notNull(),
  skippedCount: integer("skipped_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredOn: date("occurred_on").notNull(),
    kind: transactionKind("kind").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    paidByUserId: uuid("paid_by_user_id")
      .notNull()
      .references(() => users.id),
    scope: transactionScope("scope").notNull(),
    paymentMethodId: uuid("payment_method_id").references(
      () => paymentMethods.id,
    ),
    goalId: uuid("goal_id").references(() => goals.id),
    note: text("note"),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),
    fingerprint: text("fingerprint").unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transactions_occurred_on_idx").on(table.occurredOn),
    index("transactions_category_occurred_on_idx").on(
      table.categoryId,
      table.occurredOn,
    ),
    index("transactions_kind_occurred_on_idx").on(
      table.kind,
      table.occurredOn,
    ),
  ],
);

export const categoryRules = pgTable("category_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchType: ruleMatchType("match_type").notNull(),
  pattern: text("pattern").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  scope: transactionScope("scope"),
  priority: integer("priority").notNull().default(0),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  savedAmount: numeric("saved_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  deadline: date("deadline"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
