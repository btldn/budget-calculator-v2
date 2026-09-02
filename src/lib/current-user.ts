import "server-only";

import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export const ACTIVE_USER_COOKIE = "active_user_id";

export async function getAllUsers() {
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const activeUserId = cookieStore.get(ACTIVE_USER_COOKIE)?.value;

  if (activeUserId) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, activeUserId))
      .limit(1);
    if (user) {
      return user;
    }
  }

  const [firstUser] = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(1);

  return firstUser ?? null;
}
