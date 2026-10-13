import { AddPaySlotDialog } from "@/components/add-pay-slot-dialog";
import { PayScheduleSettingsRow } from "@/components/pay-schedule-settings-row";
import type { PaySlot } from "@/lib/queries/payday";

export function PayScheduleSettingsList({ slots }: { slots: PaySlot[] }) {
  return (
    <div className="space-y-2">
      {slots.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">
          Выплат пока нет. Добавьте, например, «Аванс — 10» и «Зарплата — 25».
        </p>
      ) : (
        <div className="space-y-1">
          {slots.map((slot) => (
            // Поля строки держат локальный state — при смене данных пересоздаём.
            <PayScheduleSettingsRow
              key={`${slot.id}:${slot.label}:${slot.dayOfMonth}`}
              slot={slot}
            />
          ))}
        </div>
      )}

      <AddPaySlotDialog />
    </div>
  );
}
