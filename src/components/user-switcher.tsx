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
    <div className="flex items-center gap-1 rounded-lg border p-0.5">
      {users.map((user) => {
        const isActive = user.id === currentUserId;
        return (
          <Button
            key={user.id}
            type="button"
            size="sm"
            variant={isActive ? "secondary" : "ghost"}
            disabled={isPending}
            className={cn(!isActive && "text-muted-foreground")}
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
