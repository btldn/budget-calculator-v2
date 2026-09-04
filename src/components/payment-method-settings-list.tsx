import { AddPaymentMethodDialog } from "@/components/add-payment-method-dialog";
import { PaymentMethodSettingsRow } from "@/components/payment-method-settings-row";

type Method = { id: string; name: string; archivedAt: Date | null };

export function PaymentMethodSettingsList({
  active,
  archived,
}: {
  active: Method[];
  archived: Method[];
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {active.map((method) => (
          <PaymentMethodSettingsRow key={method.id} method={method} />
        ))}
      </div>

      <AddPaymentMethodDialog />

      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Архивные ({archived.length})
          </summary>
          <div className="mt-2 space-y-1">
            {archived.map((method) => (
              <PaymentMethodSettingsRow key={method.id} method={method} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
