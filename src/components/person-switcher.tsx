import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type User = { id: string; displayName: string };

export function PersonSwitcher({
  users,
  month,
  paidByUserId,
}: {
  users: User[];
  month: string;
  paidByUserId: string | null;
}) {
  const options = [{ id: null, label: "Все" }, ...users.map((user) => ({
    id: user.id,
    label: user.displayName,
  }))];

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-card p-1">
      {options.map((option) => {
        const isActive = option.id === paidByUserId;
        const href = option.id
          ? `/?month=${month}&paidBy=${option.id}`
          : `/?month=${month}`;

        return (
          <Button
            key={option.id ?? "all"}
            variant="ghost"
            size="sm"
            nativeButton={false}
            className={cn(
              "rounded-[9px] px-3.5",
              isActive
                ? "bg-muted text-foreground hover:bg-muted"
                : "text-muted-foreground",
            )}
            render={<Link href={href} />}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
