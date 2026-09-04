import "server-only";

import { asc, isNull } from "drizzle-orm";

import { db } from "@/db";
import { goals } from "@/db/schema";

export async function getGoals() {
  return db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt))
    .orderBy(asc(goals.deadline), asc(goals.title));
}
