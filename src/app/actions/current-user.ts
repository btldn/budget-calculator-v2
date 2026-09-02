"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { ACTIVE_USER_COOKIE } from "@/lib/current-user";

export async function setCurrentUserAction(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_USER_COOKIE, userId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
