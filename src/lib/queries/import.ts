import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { importBatches, users } from "@/db/schema";

export type ImportBatchRow = {
  id: string;
  source: "csv" | "txt" | "xlsx";
  originalFilename: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  createdAt: Date;
  uploadedByName: string;
};

export async function getImportBatches(limit = 20): Promise<ImportBatchRow[]> {
  return db
    .select({
      id: importBatches.id,
      source: importBatches.source,
      originalFilename: importBatches.originalFilename,
      rowCount: importBatches.rowCount,
      importedCount: importBatches.importedCount,
      skippedCount: importBatches.skippedCount,
      createdAt: importBatches.createdAt,
      uploadedByName: users.displayName,
    })
    .from(importBatches)
    .innerJoin(users, eq(users.id, importBatches.uploadedByUserId))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit);
}
