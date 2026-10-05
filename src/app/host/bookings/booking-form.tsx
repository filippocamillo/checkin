import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { Booking, Property } from "@/lib/types";

export function BookingForm({
  properties,
  booking,
  action,
  submitLabel = "Salva",
}: {
  properties: Pick<Property, "id" | "name">[];
  booking?: Booking;
  action: (fd: FormData) => Promise<void>;
  submitLabel?: string;
}) {
  const b = booking;
  return (
    <form action={action}>
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Appartamento">
          <Select name="property_id" defaultValue={b?.property_id ?? properties[0]?.id} required>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Canale">
          <Select name="channel" defaultValue={b?.channel ?? "direct"}>
            <option value="direct">Diretta</option>
            <option value="airbnb">Airbnb</option>
            <option value="booking">Booking.com</option>
            <option value="other">Altro</option>
          </Select>
        </Field>
        <Field label="Codice prenotazione">
          <Input name="external_ref" defaultValue={b?.external_ref ?? ""} />
        </Field>
        <Field label="Arrivo">
          <Input name="check_in" type="date" defaultValue={b?.check_in} required />
        </Field>
        <Field label="Partenza">
          <Input name="check_out" type="date" defaultValue={b?.check_out} required />
        </Field>
        <Field label="Tipo di gruppo" hint="Serve per Alloggiati Web">
          <Select name="party" defaultValue={b?.party ?? "single"}>
            <option value="single">Ospite singolo</option>
            <option value="family">Famiglia</option>
            <option value="group">Gruppo</option>
          </Select>
        </Field>
        <Field label="Adulti">
          <Input name="adults" type="number" min={1} defaultValue={b?.adults ?? 2} />
        </Field>
        <Field label="Bambini">
          <Input name="children" type="number" min={0} defaultValue={b?.children ?? 0} />
        </Field>
        <Field label="Neonati" hint="Attiva il promemoria per la culla">
          <Input name="infants" type="number" min={0} defaultValue={b?.infants ?? 0} />
        </Field>
        <Field label="Intestatario">
          <Input name="lead_name" defaultValue={b?.lead_name ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="lead_email" type="email" defaultValue={b?.lead_email ?? ""} />
        </Field>
        <Field label="Telefono">
          <Input name="lead_phone" type="tel" defaultValue={b?.lead_phone ?? ""} />
        </Field>
        <Field label="Importo totale (€)">
          <Input name="total_amount" inputMode="decimal" defaultValue={b?.total_amount ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note">
            <Textarea name="notes" defaultValue={b?.notes ?? ""} className="min-h-11" />
          </Field>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </Card>
    </form>
  );
}
