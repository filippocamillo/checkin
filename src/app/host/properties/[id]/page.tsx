import { notFound } from "next/navigation";
import { Badge, Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL_LABEL, type IcalFeed, type Property } from "@/lib/types";
import { addFeed, deleteFeed, syncFeedNow, updateProperty } from "../actions";
import { PropertyForm } from "../property-form";

export default async function PropertyPage({ params }: PageProps<"/host/properties/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: property }, { data: feeds }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("ical_feeds").select("*").eq("property_id", id).order("created_at"),
  ]);
  if (!property) notFound();

  return (
    <>
      <PageHeader title={property.name} subtitle="Configurazione dell'appartamento" />

      <Card className="mb-6 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Calendari Airbnb e Booking</h2>
          <p className="text-sm text-fg-muted">
            Incolla il link iCal di esportazione: le prenotazioni vengono importate in automatico ogni ora. I dati degli ospiti
            arrivano poi dal link che invii a ciascuno.
          </p>
        </div>
        {(feeds as IcalFeed[] | null)?.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="info">{CHANNEL_LABEL[f.channel]}</Badge>
                {f.last_error ? <Badge tone="danger">Errore</Badge> : f.last_synced_at ? <Badge tone="ok">Sincronizzato</Badge> : null}
              </div>
              <p className="mt-1 truncate text-xs text-fg-muted">{f.url}</p>
              {f.last_error && <p className="text-xs text-danger">{f.last_error}</p>}
            </div>
            <div className="flex gap-2">
              <form action={syncFeedNow.bind(null, id, f.id)}>
                <Button variant="secondary">Aggiorna</Button>
              </form>
              <form action={deleteFeed.bind(null, id, f.id)}>
                <Button variant="ghost">Rimuovi</Button>
              </form>
            </div>
          </div>
        ))}
        <form action={addFeed.bind(null, id)} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <Field label="Portale">
            <Select name="channel" defaultValue="airbnb">
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking.com</option>
              <option value="other">Altro</option>
            </Select>
          </Field>
          <Field label="Link iCal">
            <Input name="url" type="url" placeholder="https://…" required />
          </Field>
          <Button type="submit">Aggiungi</Button>
        </form>
      </Card>

      <PropertyForm property={property as Property} action={updateProperty.bind(null, id)} />
    </>
  );
}
