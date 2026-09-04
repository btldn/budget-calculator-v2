"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setCurrentUserAction } from "@/app/actions/current-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type User = { id: string; displayName: string };

export function UserSwitcher({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-muted p-1">
      {users.map((user) => {
        const isActive = user.id === currentUserId;
        return (
          <Button
            key={user.id}
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            className={cn(
              "rounded-[9px] px-3.5",
              isActive
                ? "bg-card text-foreground shadow-sm hover:bg-card"
                : "text-muted-foreground",
            )}
            onClick={() => {
              if (isActive) return;
              startTransition(async () => {
                await setCurrentUserAction(user.id);
                router.refresh();
              });
            }}
          >
            {user.displayName}
          </Button>
        );
      })}
    </div>
  );
}
